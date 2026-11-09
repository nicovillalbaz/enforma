import { approveFixtureCoach } from '../helpers/coach-approval.js';
import 'dotenv/config';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { buildApp } from '../../apps/api/src/app.js';
import { actorTransaction } from '../../apps/api/src/organizations.js';
import { maintainMedia } from '../../apps/worker/src/media-maintenance.js';
import { isolatedDatabase } from '../helpers/database.js';
import {
  freshSet,
  dateAt,
  type ProgramDocument,
  type ProgramVersion,
  type WorkoutSession,
} from '@forma/shared';
const fixture = isolatedDatabase(),
  admin = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_ADMIN_URL), max: 3 }),
  api = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_URL), max: 3 }),
  worker = new pg.Pool({ connectionString: fixture.url(process.env.WORKER_DATABASE_URL), max: 3 });
let server: Awaited<ReturnType<typeof buildApp>>,
  directory: string,
  ip = 1;
function client() {
  let cookie = '',
    csrf = '';
  const address = `127.0.3.${ip++}`;
  return {
    async call(
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      url: string,
      body?: unknown,
      headers: Record<string, string> = {},
    ) {
      if (!csrf) {
        const r = await server.inject({ url: '/v1/security/csrf', remoteAddress: address });
        csrf = r.json().token;
        cookie = String(r.headers['set-cookie']).split(';')[0]!;
      }
      const r = await server.inject({
        method,
        url,
        remoteAddress: address,
        headers: { cookie, 'x-csrf-token': csrf, ...headers },
        ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
      });
      const set = r.headers['set-cookie'];
      for (const v of set ? (Array.isArray(set) ? set : [set]) : []) {
        const pair = v.split(';')[0]!,
          name = pair.split('=')[0]!;
        cookie = cookie
          .split('; ')
          .filter((x) => !x.startsWith(name + '='))
          .concat(pair)
          .join('; ');
      }
      return r;
    },
  };
}
async function coach(label: string) {
  const http = client(),
    suffix = randomUUID().slice(0, 8);
  const r = await http.call('POST', '/v1/auth/register-coach', {
    fullName: 'Coach Rutinas',
    email: `${label}-${suffix}@example.test`,
    password: 'Programs-password-2026!',
    name: 'Programas ' + label,
    slug: `program-${label}-${suffix}`,
    kind: 'coach',
    accent: '#005ea8',
    plan: 'basic',
    privacyAccepted: true,
  });
  expect(r.statusCode, r.body).toBe(201);
  await approveFixtureCoach(admin, r.json().organizationId);
  const userId = (await http.call('GET', '/v1/auth/me')).json().user.id;
  await admin.query('UPDATE app_users SET email_verified_at=now() WHERE id=$1', [userId]);
  return { http, id: r.json().organizationId as string, userId };
}
type Coach = Awaited<ReturnType<typeof coach>>;
async function pupil(owner: Coach, label: string) {
  const email = `${label.replaceAll(' ', '-')}-${randomUUID().slice(0, 8)}@example.test`;
  const created = await owner.http.call('POST', `/v1/organizations/${owner.id}/students`, {
    displayName: label,
    email,
    goal: 'Fuerza',
  });
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json().student.id as string;
  const invitation = (
    await owner.http.call('POST', `/v1/organizations/${owner.id}/students/${id}/invitation`)
  ).json().url;
  const http = client();
  const r = await http.call('POST', '/v1/invitations/accept', {
    token: new URL(invitation).searchParams.get('token'),
    fullName: label,
    goal: 'Fuerza',
    password: 'Student-programs-2026!',
    privacyAccepted: true,
  });
  expect(r.statusCode, r.body).toBe(200);
  return { id, http, userId: (await http.call('GET', '/v1/auth/me')).json().user.id };
}
let a: Coach,
  b: Coach,
  professional: Coach,
  s1: Awaited<ReturnType<typeof pupil>>,
  s2: Awaited<ReturnType<typeof pupil>>,
  root: string,
  version: ProgramVersion,
  assignmentId: string;
const sessions: WorkoutSession[] = [];
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const deviceId = randomUUID();
async function event(s: WorkoutSession, command: Record<string, unknown>) {
  const response = await s1.http.call('POST', root + `/workouts/${s.id}/events`, {
    clientEventId: randomUUID(),
    deviceId,
    command: {
      expectedRevision: s.revision,
      clientOccurredAt: new Date().toISOString(),
      ...command,
    },
  });
  expect(response.statusCode, response.body).toBe(200);
  expect(response.json().receipt.status, response.body).toBe('accepted');
  return response.json().session as WorkoutSession;
}
async function metrics(http = s1.http, from = dateAt(today(), -3), to = today(), student = s1.id) {
  return http.call('GET', root + `/progress/${student}?from=${from}&to=${to}`);
}
async function privacy(
  consent: boolean,
  measurements: boolean,
  photos: boolean,
  revision?: number,
) {
  const current = (await s1.http.call('GET', root + `/progress/${s1.id}/privacy`)).json().privacy;
  const response = await s1.http.call('PUT', root + `/progress/${s1.id}/privacy`, {
    revision: revision ?? current.revision,
    photoConsent: consent,
    professionals: current.professionals.map((p: { id: string }) => ({
      id: p.id,
      measurements: p.id === a.userId && measurements,
      photos: p.id === a.userId && photos,
    })),
  });
  return response;
}
beforeAll(async () => {
  directory = await fixture.create();
  server = await buildApp({
    origin: 'http://127.0.0.1:5173',
    cookieSecret: 'progress-tests-cookie-secret-at-least-32',
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    storageRoot: directory,
    developmentMailbox: true,
  });
  a = await coach('progress');
  b = await coach('foreign');
  professional = await coach('assigned');
  s1 = await pupil(a, 'Alumna Progreso');
  s2 = await pupil(a, 'Otra Alumna');
  root = `/v1/organizations/${a.id}`;
  await admin.query(
    "INSERT INTO organization_memberships(organization_id,user_id,role)VALUES($1,$2,'coach')",
    [a.id, professional.userId],
  );
  await admin.query('INSERT INTO student_professionals VALUES($1,$2,$3)', [
    a.id,
    s1.id,
    professional.userId,
  ]);
  const exercises: { id: string; metric: 'reps' | 'time' | 'distance' }[] = [];
  for (const [name, metric] of [
    ['Press original', 'reps'],
    ['Plancha original', 'time'],
    ['Caminata original', 'distance'],
  ]) {
    const r = await a.http.call('POST', root + '/exercises', {
      name,
      instructions: 'Instrucción original congelada de prueba.',
      muscle: 'General',
      equipmentTag: '',
      metric,
      variations: [],
      tags: [],
      state: 'published',
      equipmentId: null,
      mediaId: null,
    });
    expect(r.statusCode, r.body).toBe(201);
    exercises.push(r.json().exercise);
  }
  const document: ProgramDocument = {
    name: 'Progreso verificable',
    description: 'Fixture de cálculo manual',
    isTemplate: false,
    weeks: [
      {
        id: randomUUID(),
        name: 'Semana base',
        days: Array.from({ length: 4 }, (_, i) => ({
          id: randomUUID(),
          name: `Día ${i + 1}`,
          weekday: i + 1,
          notes: '',
          exercises: exercises.map((e) => ({
            id: randomUUID(),
            exerciseId: e.id,
            notes: '',
            sets: Array.from({ length: e.metric === 'reps' ? 3 : 1 }, () => freshSet(e.metric)),
          })),
        })),
      },
    ],
  };
  const p = (await a.http.call('POST', root + '/programs', { document })).json().program;
  version = (await a.http.call('POST', root + `/programs/${p.id}/publish`, { revision: 1 })).json()
    .version;
  const r = await a.http.call('POST', root + `/program-versions/${version.id}/assignments`, {
    studentIds: [s1.id],
    startsOn: dateAt(today(), -3),
    requestId: randomUUID(),
  });
  expect(r.statusCode, r.body).toBe(201);
  assignmentId = r.json().assignments[0].id;
  for (const d of document.weeks[0]!.days.slice(0, 3)) {
    let s = (
      await s1.http.call('POST', root + '/workouts/prepare', {
        assignmentId,
        weekId: document.weeks[0]!.id,
        dayId: d.id,
      })
    ).json().session as WorkoutSession;
    s = await event(s, { kind: 'session.start' });
    sessions.push(s);
  }
  const actuals = [
    { weightKg: 20, reps: 10, seconds: null, distanceMeters: null, rpe: 7, note: '' },
    { weightKg: 0, reps: 15, seconds: null, distanceMeters: null, rpe: null, note: '' },
    { weightKg: null, reps: 12, seconds: null, distanceMeters: null, rpe: null, note: '' },
    { weightKg: null, reps: null, seconds: 60, distanceMeters: null, rpe: null, note: '' },
    { weightKg: null, reps: null, seconds: null, distanceMeters: 1500, rpe: null, note: '' },
  ];
  for (let i = 0; i < 5; i++) {
    const set = sessions[0]!.sets[i]!;
    sessions[0] = await event(sessions[0]!, {
      kind: 'set.save',
      expectedRevision: set.revision,
      entryId: set.entryId,
      setId: set.setId,
      actual: actuals[i],
    });
  }
  sessions[0] = await event(sessions[0]!, {
    kind: 'session.complete',
    notes: 'Completa',
    durationSeconds: 600,
    allowPartial: false,
  });
  for (const i of [1, 2]) {
    const set = sessions[i]!.sets[0]!;
    sessions[i] = await event(sessions[i]!, {
      kind: 'set.save',
      expectedRevision: 0,
      entryId: set.entryId,
      setId: set.setId,
      actual: {
        weightKg: i === 1 ? 25 : 99,
        reps: i === 1 ? 8 : 99,
        seconds: null,
        distanceMeters: null,
        rpe: null,
        note: '',
      },
    });
  }
  sessions[1] = await event(sessions[1]!, {
    kind: 'session.complete',
    notes: 'Parcial',
    durationSeconds: 300,
    allowPartial: true,
  });
}, 40000);
afterAll(async () => {
  await server?.close();
  await api.end();
  await worker.end();
  await admin.end();
  await fixture.drop();
});
describe('T06 confirmed progress and private measurements', () => {
  it('matches manual volume, adherence, partials and distinct units without counting unfinished sets', async () => {
    const r = await metrics();
    expect(r.statusCode, r.body).toBe(200);
    const m = r.json().metrics;
    expect(m.summary).toMatchObject({
      sessions: 2,
      partialSessions: 1,
      inProgress: 1,
      recordedSets: 6,
      volumeKgReps: 400,
      unweightedSets: 1,
      expectedDays: 4,
      completedDays: 2,
      missedDays: 1,
      todayPending: 1,
      cancelledDays: 0,
    });
    expect(m.weekly.reduce((n: number, w: { volumeKgReps: number }) => n + w.volumeKgReps, 0)).toBe(
      400,
    );
    expect(m.exercises.find((e: { metric: string }) => e.metric === 'reps')).toMatchObject({
      bestLoadKg: 25,
      bestLoadReps: 8,
      volumeKgReps: 400,
      unweightedSets: 1,
    });
    expect(m.exercises.find((e: { metric: string }) => e.metric === 'time').bestSeconds).toBe(60);
    expect(
      m.exercises.find((e: { metric: string }) => e.metric === 'distance').bestDistanceMeters,
    ).toBe(1500);
    expect(m.comparison.last7Volume).toBe(400);
    expect(m.comparison.previous7Volume).toBe(0);
  });
  it('scopes student/professional/tenant access and bounds ranges', async () => {
    expect((await metrics(a.http)).statusCode).toBe(200);
    expect((await metrics(professional.http)).statusCode).toBe(200);
    expect((await metrics(s2.http)).statusCode).toBe(404);
    expect((await metrics(b.http)).statusCode).toBe(404);
    expect((await metrics(s1.http, dateAt(today(), -367))).statusCode).toBe(400);
    expect((await metrics(s1.http, today(), dateAt(today(), 1))).statusCode).toBe(400);
    expect((await metrics(s1.http, '2026-02-30')).statusCode).toBe(400);
    expect((await s1.http.call('GET', root + '/progress')).statusCode).toBe(403);
  });
  it('withdraws reopened sessions and undone sets from official metrics without duplicating on reclose', async () => {
    sessions[0] = await event(sessions[0]!, {
      kind: 'session.reopen',
      reason: 'Corregir una serie',
    });
    expect((await metrics()).json().metrics.summary).toMatchObject({
      sessions: 1,
      volumeKgReps: 200,
      recordedSets: 1,
    });
    const set = sessions[0]!.sets[0]!;
    sessions[0] = await event(sessions[0]!, {
      kind: 'set.undo',
      entryId: set.entryId,
      setId: set.setId,
      expectedRevision: set.revision,
    });
    sessions[0] = await event(sessions[0]!, {
      kind: 'session.complete',
      notes: 'Corregida parcial',
      durationSeconds: 650,
      allowPartial: true,
    });
    const m = (await metrics()).json().metrics;
    expect(m.summary).toMatchObject({
      sessions: 2,
      partialSessions: 2,
      volumeKgReps: 200,
      recordedSets: 5,
      completedDays: 2,
    });
    expect(m.exercises.find((e: { metric: string }) => e.metric === 'reps').bestLoadKg).toBe(25);
  });
  it('keeps frozen names and date-only grouping independent of database timezone', async () => {
    const id = version.snapshot.weeks[0]!.days[0]!.exercises[0]!.exerciseId;
    await admin.query("UPDATE exercises SET name='Nombre nuevo',metric='distance' WHERE id=$1", [
      id,
    ]);
    const first = (await metrics()).json().metrics;
    expect(first.exercises.find((e: { metric: string }) => e.metric === 'reps').name).toBe(
      'Press original',
    );
    const other = await actorTransaction(api, s1.userId, a.id, async (db) => {
      await db.query("SET LOCAL TIME ZONE 'Pacific/Kiritimati'");
      return (
        await db.query('SELECT app.progress_metrics($1,$2,$3,NULL) data', [
          s1.id,
          dateAt(today(), -3),
          today(),
        ])
      ).rows[0].data;
    });
    expect(other.weekly).toEqual(first.weekly);
    expect(other.summary.volumeKgReps).toBe(first.summary.volumeKgReps);
  });
  it('records immutable measurements and keeps student facts private until shared', async () => {
    const url = root + `/progress/${s1.id}/measurements`,
      body = { kind: 'weight', value: 70.5, measuredOn: today(), requestId: randomUUID() };
    expect((await a.http.call('GET', url)).json().measurements).toEqual([]);
    expect((await professional.http.call('GET', url)).statusCode).toBe(403);
    const first = await s1.http.call('POST', url, body);
    expect(first.statusCode, first.body).toBe(201);
    const id = first.json().measurement.id;
    expect((await a.http.call('GET', url)).json().measurements).toEqual([]);
    expect((await s1.http.call('POST', url, body)).json().measurement.id).toBe(id);
    expect((await s1.http.call('POST', url, { ...body, value: 71 })).json().code).toBe(
      'IDEMPOTENCY_CONFLICT',
    );
    for (const value of [null, '70', 0, 501])
      expect(
        (await s1.http.call('POST', url, { ...body, requestId: randomUUID(), value })).statusCode,
      ).toBe(400);
    expect(
      (
        await s1.http.call('POST', url, {
          ...body,
          requestId: randomUUID(),
          measuredOn: '2026-02-30',
        })
      ).statusCode,
    ).toBe(400);
    expect((await privacy(false, true, false)).statusCode).toBe(200);
    expect((await a.http.call('GET', url)).json().measurements[0]).toMatchObject({
      value: 70.5,
      unit: 'kg',
      source: 'self',
    });
    const fromCoach = await a.http.call('POST', url, {
      kind: 'waist',
      value: 80,
      measuredOn: today(),
      requestId: randomUUID(),
    });
    expect(fromCoach.json().measurement.source).toBe('coach');
    const correctionBody = {
      value: 81,
      measuredOn: today(),
      reason: 'Lectura transcrita errónea',
      requestId: randomUUID(),
    };
    const correctionPath = url + `/${fromCoach.json().measurement.id}/correct`;
    const corrected = await a.http.call('POST', correctionPath, correctionBody);
    expect(corrected.statusCode, corrected.body).toBe(200);
    expect(corrected.json().measurement.correctionOf).toBe(fromCoach.json().measurement.id);
    expect((await a.http.call('POST', correctionPath, correctionBody)).json().measurement.id).toBe(
      corrected.json().measurement.id,
    );
    const measured = (await a.http.call('GET', url)).json().measurements;
    expect(
      measured.find((m: { id: string }) => m.id === fromCoach.json().measurement.id).voidedAt,
    ).not.toBeNull();
    await expect(
      admin.query('UPDATE body_measurements SET value=90 WHERE id=$1', [id]),
    ).rejects.toThrow('IMMUTABLE_EVENT');
    expect(
      (
        await actorTransaction(api, professional.userId, a.id, (db) =>
          db.query('SELECT id FROM body_measurements'),
        )
      ).rows,
    ).toEqual([]);
    expect(
      (await s1.http.call('POST', url + `/${id}/void`, { reason: 'Error al introducir el dato' }))
        .statusCode,
    ).toBe(200);
    expect(
      (await s1.http.call('GET', url)).json().measurements.find((r: { id: string }) => r.id === id)
        .voidedAt,
    ).not.toBeNull();
  });
  it('rejects stale/null privacy changes and hides student measurements after revocation', async () => {
    const prefs = (await s1.http.call('GET', root + `/progress/${s1.id}/privacy`)).json().privacy;
    expect((await privacy(false, false, false)).statusCode).toBe(200);
    expect((await privacy(false, false, false, prefs.revision)).statusCode).toBe(409);
    expect(
      (
        await s1.http.call('PUT', root + `/progress/${s1.id}/privacy`, {
          revision: null,
          photoConsent: false,
          professionals: [],
        })
      ).statusCode,
    ).toBe(400);
    expect((await privacy(false, false, false)).statusCode).toBe(200);
    const coachView = (await a.http.call('GET', root + `/progress/${s1.id}/measurements`)).json();
    expect(coachView.measurements.every((m: { source: string }) => m.source === 'coach')).toBe(
      true,
    );
    expect((await metrics(a.http)).json().metrics.access.measurements).toBe(true);
  });
  it('exports a bounded student record without exposing another student or private facts', async () => {
    const path = root + `/students/${s1.id}/record?from=${today()}&to=${today()}`;
    const ownerRecord = await a.http.call('GET', path);
    expect(ownerRecord.statusCode, ownerRecord.body).toBe(200);
    expect(ownerRecord.json().measurementsPrivate).toBe(true);
    expect(
      ownerRecord.json().measurements.every((m: { source: string }) => m.source === 'coach'),
    ).toBe(true);
    expect((await s1.http.call('GET', path)).statusCode).toBe(200);
    expect((await s1.http.call('GET', root + `/students/${s2.id}/record`)).statusCode).toBe(404);
    const xlsx = await a.http.call('GET', path.replace('/record?', '/export.xlsx?'));
    expect(xlsx.statusCode, xlsx.body).toBe(200);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(xlsx.rawPayload.subarray(0, 2).toString()).toBe('PK');
    expect(
      (await a.http.call('GET', root + `/students/${s1.id}/record?from=2020-01-01&to=${today()}`))
        .statusCode,
    ).toBe(400);
  });
  it('normalizes private photos, creates a thumbnail and never exposes them as library media', async () => {
    const image = await sharp({
        create: { width: 600, height: 800, channels: 3, background: '#005ea8' },
      })
        .png()
        .withMetadata({ orientation: 6 })
        .toBuffer(),
      dataUrl = 'data:image/png;base64,' + image.toString('base64'),
      path = root + `/progress/${s1.id}/photos`,
      body = {
        requestId: randomUUID(),
        measuredOn: today(),
        caption: 'Imagen sintética, sin persona',
        dataUrl,
      };
    expect((await s1.http.call('POST', path, body)).statusCode).toBe(403);
    expect((await privacy(true, false, false)).statusCode).toBe(200);
    const created = await s1.http.call('POST', path, body);
    expect(created.statusCode, created.body).toBe(201);
    const photo = created.json().photo;
    expect(photo.width).toBe(800);
    expect(photo.height).toBe(600);
    expect((await s1.http.call('POST', path, body)).json().photo.id).toBe(photo.id);
    const file = await s1.http.call('GET', photo.url),
      thumbnail = await s1.http.call('GET', photo.thumbnailUrl);
    expect(file.statusCode, file.body).toBe(200);
    expect(file.headers['cache-control']).toBe('private, no-store');
    const meta = await sharp(file.rawPayload).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect((await sharp(thumbnail.rawPayload).metadata()).width).toBe(320);
    expect((await a.http.call('GET', photo.url)).statusCode).toBe(404);
    expect((await a.http.call('GET', root + `/media/${photo.id}/file`)).statusCode).toBe(404);
    expect((await privacy(true, false, true)).statusCode).toBe(200);
    expect((await a.http.call('GET', photo.url)).statusCode).toBe(200);
    expect((await professional.http.call('GET', photo.url)).statusCode).toBe(404);
    expect((await s2.http.call('GET', photo.url)).statusCode).toBe(404);
    expect((await privacy(false, false, false)).statusCode).toBe(200);
    expect((await a.http.call('GET', photo.url)).statusCode).toBe(404);
    expect((await s1.http.call('GET', photo.url)).statusCode).toBe(404);
    expect((await privacy(true, false, true)).statusCode).toBe(200);
    expect((await s1.http.call('GET', path)).json().photos).toEqual([]);
    expect((await s1.http.call('POST', path, body)).json().code).toBe('PROGRESS_PHOTO_REMOVED');
    const row = (
      await admin.query('SELECT storage_key,thumbnail_key FROM progress_photos WHERE id=$1', [
        photo.id,
      ])
    ).rows[0];
    expect(
      (await worker.query('SELECT app.media_storage_references() key')).rows.map((r) => r.key),
    ).toContain(row.storage_key);
    await admin.query(
      "UPDATE progress_photos SET deleted_at=now()-interval '31 days' WHERE id=$1",
      [photo.id],
    );
    await maintainMedia(worker, directory);
    expect((await s1.http.call('POST', path, body)).json().code).toBe('PROGRESS_PHOTO_REMOVED');
    expect(
      (await worker.query('SELECT app.media_storage_references() key')).rows.map((r) => r.key),
    ).not.toContain(row.storage_key);
  });
  it('configures inactivity per professional with revision and paginates a scoped roster', async () => {
    const p = root + `/progress/${s1.id}/alert`;
    expect((await s1.http.call('PUT', p, { revision: 0, days: 7, enabled: true })).statusCode).toBe(
      403,
    );
    expect((await a.http.call('PUT', p, { revision: 0, days: 7, enabled: true })).statusCode).toBe(
      200,
    );
    expect((await a.http.call('PUT', p, { revision: 0, days: 14, enabled: true })).statusCode).toBe(
      409,
    );
    expect(
      (await a.http.call('PUT', p, { revision: 1, days: null, enabled: true })).statusCode,
    ).toBe(400);
    const roster = (await professional.http.call('GET', root + '/progress')).json().students;
    expect(roster.map((s: { id: string }) => s.id)).toEqual([s1.id]);
    expect((await metrics(a.http)).json().metrics.activity.thresholdDays).toBe(7);
    expect((await metrics(professional.http)).json().metrics.activity.thresholdDays).toBe(14);
    const one = (await a.http.call('GET', root + '/progress?limit=1')).json();
    expect(one.nextCursor).toBeTruthy();
    const next = (
      await a.http.call('GET', root + '/progress?limit=1&cursor=' + one.nextCursor)
    ).json();
    expect(next.students[0].id).not.toBe(one.students[0].id);
  });
  it('shows cancelled obligations separately and does not duplicate a replacement on the same date', async () => {
    expect(
      (
        await a.http.call('POST', root + `/program-assignments/${assignmentId}/cancel`, {
          revision: 1,
          reason: 'Cambiar planificación',
        })
      ).statusCode,
    ).toBe(200);
    await admin.query(
      "UPDATE program_assignments SET cancelled_at=($1::date+interval '12 hours') AT TIME ZONE 'America/Asuncion' WHERE id=$2",
      [dateAt(today(), -2), assignmentId],
    );
    let m = (await metrics()).json().metrics;
    expect(m.summary).toMatchObject({
      expectedDays: 2,
      completedDays: 2,
      cancelledDays: 2,
      missedDays: 0,
    });
    const assigned = await a.http.call(
      'POST',
      root + `/program-versions/${version.id}/assignments`,
      { studentIds: [s1.id], startsOn: today(), requestId: randomUUID() },
    );
    expect(assigned.statusCode, assigned.body).toBe(201);
    m = (await metrics()).json().metrics;
    expect(m.summary).toMatchObject({
      expectedDays: 3,
      completedDays: 2,
      cancelledDays: 1,
      todayPending: 1,
    });
  });
  it('paginates and filters batched history while keeping complete set details', async () => {
    let r = await a.http.call(
      'GET',
      root +
        `/workouts?studentId=${s1.id}&state=completed&from=${dateAt(today(), -3)}&to=${today()}&limit=1`,
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().sessions).toHaveLength(1);
    expect(r.json().sessions[0].sets).toHaveLength(5);
    const cursor = r.json().nextBefore;
    expect(cursor).toBeTruthy();
    r = await a.http.call(
      'GET',
      root + `/workouts?studentId=${s1.id}&state=completed&before=${cursor}&limit=1`,
    );
    expect(r.json().sessions).toHaveLength(1);
    expect(r.json().nextBefore).toBeNull();
    expect(
      (await a.http.call('GET', root + `/workouts?studentId=${s1.id}&state=planned`)).json()
        .sessions,
    ).toEqual([]);
  });
  it('uses the latest valid measurement per day across all history pages', async () => {
    const path = root + `/progress/${s1.id}/measurements`;
    for (const value of [71, 72])
      expect(
        (
          await s1.http.call('POST', path, {
            kind: 'weight',
            value,
            measuredOn: today(),
            requestId: randomUUID(),
          })
        ).statusCode,
      ).toBe(201);
    const first = (await s1.http.call('GET', path + '?kind=weight&limit=1')).json();
    expect(first.nextCursor).toBeTruthy();
    expect(
      (await s1.http.call('GET', path + '?kind=weight&limit=1&cursor=' + first.nextCursor)).json()
        .measurements[0].id,
    ).not.toBe(first.measurements[0].id);
    const r = await s1.http.call(
      'GET',
      path + `/trend?kind=weight&from=${dateAt(today(), -27)}&to=${today()}`,
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().points).toEqual([{ date: today(), value: 72 }]);
  });
  it('serializes duplicate photo uploads, includes their bytes in all studio quotas and cleans rejected files', async () => {
    await privacy(true, false, false);
    const { readdir } = await import('node:fs/promises'),
      path = root + `/progress/${s1.id}/photos`,
      input = await sharp({
        create: { width: 80, height: 100, channels: 3, background: '#5577aa' },
      })
        .png()
        .toBuffer(),
      body = {
        requestId: randomUUID(),
        measuredOn: today(),
        caption: 'Concurrent synthetic photo',
        dataUrl: 'data:image/png;base64,' + input.toString('base64'),
      },
      before = await readdir(directory);
    const uploaded = await Promise.all([
      s1.http.call('POST', path, body),
      s1.http.call('POST', path, body),
    ]);
    for (const r of uploaded) expect(r.statusCode, r.body).toBeGreaterThanOrEqual(200);
    for (const r of uploaded) expect(r.statusCode, r.body).toBeLessThan(300);
    expect(uploaded[0]!.json().photo.id).toBe(uploaded[1]!.json().photo.id);
    expect((await readdir(directory)).length - before.length).toBe(2);
    const limit = (
        await admin.query(
          'SELECT l.* FROM media_plan_limits l JOIN saas_subscriptions s ON s.plan_version_id=l.plan_version_id WHERE s.organization_id=$1',
          [a.id],
        )
      ).rows[0],
      used = Number(
        (
          await admin.query(
            'SELECT sum(byte_size) used FROM progress_photos WHERE organization_id=$1',
            [a.id],
          )
        ).rows[0].used,
      );
    async function setCapacity(capacity: number) {
      const id = (
        await admin.query(
          'INSERT INTO saas_plan_versions(plan_id,version_no,per_student_price_pyg,student_limit,features)SELECT v.plan_id,(SELECT max(version_no)+1 FROM saas_plan_versions WHERE plan_id=v.plan_id),v.per_student_price_pyg,v.student_limit,v.features FROM saas_plan_versions v WHERE id=$1 RETURNING id',
          [limit.plan_version_id],
        )
      ).rows[0].id;
      await admin.query('INSERT INTO media_plan_limits VALUES($1,$2,$3)', [
        id,
        capacity,
        limit.video_seconds,
      ]);
      await admin.query(
        'UPDATE saas_subscriptions SET plan_version_id=$1 WHERE organization_id=$2',
        [id, a.id],
      );
    }
    try {
      await setCapacity(used + 100 + 2097152 - 1);
      const reserve = await a.http.call('POST', root + '/media/uploads', {
        kind: 'image',
        bytes: 100,
        requestId: randomUUID(),
      });
      expect(reserve.json().code, reserve.body).toBe('MEDIA_QUOTA');
      await setCapacity(used + 99);
      await expect(
        actorTransaction(api, a.userId, a.id, (db) =>
          db.query('SELECT app.assert_logo_budget(100)'),
        ),
      ).rejects.toThrow('MEDIA_QUOTA');
      const files = (await readdir(directory)).length,
        rejected = await s1.http.call('POST', path, { ...body, requestId: randomUUID() });
      expect(rejected.json().code, rejected.body).toBe('MEDIA_QUOTA');
      expect((await readdir(directory)).length).toBe(files);
      await expect(
        actorTransaction(api, a.userId, a.id, (db) =>
          db.query("SELECT app.reserve_media_t05('image',100,$1)", [randomUUID()]),
        ),
      ).rejects.toThrow('permission denied');
    } finally {
      await admin.query(
        'UPDATE saas_subscriptions SET plan_version_id=$1 WHERE organization_id=$2',
        [limit.plan_version_id, a.id],
      );
    }
  });
  it('aggregates 5000 additional recorded sets with the same verified formula', async () => {
    const s = sessions[1]!,
      entry = s.sets[0]!.entryId;
    await admin.query(
      "INSERT INTO workout_sets(organization_id,session_id,entry_id,set_id,position,metric,target,state,weight_kg,reps,recorded_at) SELECT $1,$2,$3,gen_random_uuid(),100+n,'reps','{}','recorded',2,3,now() FROM generate_series(1,5000)n",
      [a.id, s.id, entry],
    );
    const start = Date.now(),
      r = await metrics(),
      elapsed = Date.now() - start;
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().metrics.summary).toMatchObject({
      volumeKgReps: 30200,
      recordedSets: 5005,
      sessions: 2,
    });
    expect(elapsed).toBeLessThan(5000);
    console.log(
      JSON.stringify({
        fixture: 'T06-5000',
        additionalSets: 5000,
        elapsedMs: elapsed,
        volumeKgReps: 30200,
      }),
    );
  }, 15000);
});
