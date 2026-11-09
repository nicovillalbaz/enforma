import {
  projectWorkout,
  validWorkoutEvent,
  type WorkoutSession,
  type WorkoutEvent,
  type WorkoutCommand,
  type WorkoutResult,
  type CurrentUser,
  type OrganizationSummary,
  type Brand,
  type StudentRecord,
} from '@forma/shared';
import { apiRequest, ApiClientError } from './api';
export interface CachedWorkout {
  key: string;
  userId: string;
  organizationId: string;
  base: WorkoutSession;
  queue: WorkoutEvent[];
  blocked: { eventId: string; code: string } | null;
  restDeadline: number | null;
  updatedAt: number;
}
export interface OfflineContext {
  key: 'context';
  user: CurrentUser;
  org: OrganizationSummary;
  brand: Brand;
  portal: StudentRecord;
  expiresAt: number;
}
let connection: Promise<IDBDatabase> | null = null;
const channel =
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('forma.workouts');
function changed() {
  window.dispatchEvent(new Event('forma:workouts'));
  channel?.postMessage('changed');
}
channel?.addEventListener('message', () => window.dispatchEvent(new Event('forma:workouts')));
function database() {
  return (connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('forma.workouts.v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('sessions', { keyPath: 'key' });
      request.result.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      connection = null;
      reject(request.error);
    };
    request.onblocked = () => {
      connection = null;
      reject(new Error('Cierra otras pestañas para preparar el almacenamiento.'));
    };
  }));
}
async function all<T>(store: string): Promise<T[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function mutate(
  key: string,
  fn: (r: CachedWorkout | undefined) => CachedWorkout | undefined,
) {
  const db = await database();
  return new Promise<CachedWorkout | undefined>((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite'),
      store = tx.objectStore('sessions'),
      req = store.get(key);
    let result: CachedWorkout | undefined;
    req.onsuccess = () => {
      try {
        result = fn(req.result);
        if (result) store.put(result);
        else store.delete(key);
      } catch (e) {
        tx.abort();
        reject(e);
      }
    };
    tx.oncomplete = () => {
      changed();
      resolve(result);
    };
    tx.onabort = tx.onerror = () =>
      reject(
        tx.error ??
          new Error('No se guardó en el dispositivo. Libera espacio y vuelve a intentarlo.'),
      );
  });
}
export const workoutKey = (user: string, org: string, id: string) => `${user}/${org}/${id}`;
export async function listCachedWorkouts(user: string, org: string) {
  const rows = (await all<CachedWorkout>('sessions')).filter(
    (r) => r.userId === user && r.organizationId === org,
  );
  const expired = rows.filter((r) => !r.queue.length && r.updatedAt < Date.now() - 7 * 86400000);
  for (const row of expired)
    await mutate(row.key, (r) =>
      r && !r.queue.length && r.updatedAt < Date.now() - 7 * 86400000 ? undefined : r,
    );
  return rows.filter((r) => !expired.includes(r)).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function getCachedWorkout(key: string) {
  const rows = await all<CachedWorkout>('sessions');
  return rows.find((r) => r.key === key);
}
export async function cacheWorkout(session: WorkoutSession) {
  const key = workoutKey(session.userId, session.organizationId, session.id);
  return mutate(key, (r) =>
    r
      ? {
          ...r,
          base: session.revision >= r.base.revision ? session : r.base,
          updatedAt: Date.now(),
        }
      : {
          key,
          userId: session.userId,
          organizationId: session.organizationId,
          base: session,
          queue: [],
          blocked: null,
          restDeadline: null,
          updatedAt: Date.now(),
        },
  );
}
function device() {
  let id = localStorage.getItem('forma.workout.device');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('forma.workout.device', id);
  }
  return id;
}
export async function enqueueWorkout(key: string, command: WorkoutCommand, restSeconds?: number) {
  const event: WorkoutEvent = { clientEventId: crypto.randomUUID(), deviceId: device(), command };
  if (!validWorkoutEvent(event)) throw new Error('Revisa los valores del registro.');
  return mutate(key, (r) => {
    if (!r) throw new Error('Prepara la sesión con conexión antes de entrenar.');
    if (r.queue.length >= 500)
      throw new Error('Sincroniza los cambios pendientes antes de continuar.');
    return {
      ...r,
      queue: [...r.queue, event],
      updatedAt: Date.now(),
      ...(restSeconds === undefined ? {} : { restDeadline: Date.now() + restSeconds * 1000 }),
    };
  });
}
export async function setRestDeadline(key: string, deadline: number | null) {
  return mutate(key, (r) => (r ? { ...r, restDeadline: deadline } : undefined));
}
export function localWorkout(r: CachedWorkout) {
  return projectWorkout(r.base, r.queue);
}
const running = new Map<string, Promise<void>>();
let epoch = 0;
export function stopWorkoutSync() {
  epoch++;
}
export async function syncWorkout(key: string) {
  if (running.has(key)) return running.get(key);
  const task = drain(key).finally(() => running.delete(key));
  running.set(key, task);
  return task;
}
async function drain(key: string) {
  const currentEpoch = epoch;
  let row = await getCachedWorkout(key);
  if (!row || !row.queue.length || row.blocked) return;
  try {
    const { user } = await apiRequest<{ user: CurrentUser }>('/v1/auth/me');
    if (user.id !== row.userId)
      throw new ApiClientError(
        401,
        'ACCOUNT_CHANGED',
        'Inicia sesión con la cuenta que creó estos registros.',
      );
    while (currentEpoch === epoch) {
      row = await getCachedWorkout(key);
      if (!row || !row.queue.length || row.blocked) return;
      const head = row.queue[0]!;
      const result = await apiRequest<WorkoutResult>(
        `/v1/organizations/${row.organizationId}/workouts/${row.base.id}/events`,
        { method: 'POST', body: head },
      );
      if (currentEpoch !== epoch) return;
      await mutate(key, (r) => {
        if (!r) return;
        const base = result.session.revision >= r.base.revision ? result.session : r.base;
        if (result.receipt.status === 'rejected')
          return {
            ...r,
            base,
            blocked: { eventId: head.clientEventId, code: result.receipt.code ?? 'CONFLICT' },
          };
        return {
          ...r,
          base,
          queue: r.queue.filter((e) => e.clientEventId !== head.clientEventId),
          updatedAt: Date.now(),
        };
      });
    }
  } catch (e) {
    if (currentEpoch !== epoch) return;
    if (e instanceof ApiClientError && e.status !== 0 && e.status !== 429 && e.status < 500) {
      if ([401, 403].includes(e.status)) await forgetOfflineContext();
      await mutate(key, (r) =>
        r
          ? { ...r, blocked: { eventId: r.queue[0]?.clientEventId ?? '', code: e.code } }
          : undefined,
      );
    }
    throw e;
  }
}
export async function resolveWorkout(key: string, choice: 'server' | 'local') {
  return mutate(key, (r) => {
    if (!r?.blocked) return r;
    const index = r.queue.findIndex((e) => e.clientEventId === r.blocked!.eventId),
      event = r.queue[index];
    if (!event) return { ...r, blocked: null };
    const queue = [...r.queue];
    queue.splice(index, 1);
    if (choice === 'local') {
      const c = structuredClone(event.command);
      c.clientOccurredAt = new Date().toISOString();
      c.expectedRevision =
        c.kind === 'set.save' || c.kind === 'set.undo'
          ? r.base.sets.find((s) => s.entryId === c.entryId && s.setId === c.setId)!.revision
          : c.kind === 'session.note'
            ? r.base.notesRevision
            : r.base.revision;
      queue.splice(index, 0, { ...event, clientEventId: crypto.randomUUID(), command: c });
    }
    return { ...r, queue, blocked: null };
  });
}
export async function recheckWorkout(key: string) {
  const r = await getCachedWorkout(key);
  if (!r) return;
  const { user } = await apiRequest<{ user: CurrentUser }>('/v1/auth/me');
  if (user.id !== r.userId)
    throw new Error('Inicia sesión con la cuenta que creó estos registros.');
  const { session } = await apiRequest<{ session: WorkoutSession }>(
    `/v1/organizations/${r.organizationId}/workouts/${r.base.id}`,
  );
  if (!session.accessActive)
    throw new Error(
      'La asignación se canceló. Descarga los registros pendientes y consulta a tu coach.',
    );
  await mutate(key, (current) =>
    current ? { ...current, base: session, blocked: null } : undefined,
  );
}
export async function cacheOfflineContext(context: Omit<OfflineContext, 'key' | 'expiresAt'>) {
  if (context.org.role !== 'student') return;
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({
      ...context,
      user: { ...context.user, isSuperadmin: false },
      key: 'context',
      expiresAt: Date.now() + 86400000,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function readOfflineContext() {
  const row = (await all<OfflineContext>('meta')).find((x) => x.key === 'context');
  return row && row.expiresAt > Date.now() && row.org.role === 'student' ? row : null;
}
export async function forgetOfflineContext() {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
export async function pendingForUser(user: string) {
  return (await all<CachedWorkout>('sessions'))
    .filter((r) => r.userId === user)
    .reduce((n, r) => n + r.queue.length, 0);
}
export async function purgeWorkouts(user: string) {
  stopWorkoutSync();
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['sessions', 'meta'], 'readwrite'),
      store = tx.objectStore('sessions'),
      cursor = store.openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) {
        if (c.value.userId === user) c.delete();
        c.continue();
      }
    };
    tx.objectStore('meta').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  changed();
  channel?.postMessage('logout');
}
channel?.addEventListener('message', (e) => {
  if (e.data === 'logout') {
    stopWorkoutSync();
    window.dispatchEvent(new Event('forma:offline-logout'));
  }
});
