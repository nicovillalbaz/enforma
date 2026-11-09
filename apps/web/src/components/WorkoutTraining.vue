<script setup lang="ts">
import { confirmAction } from '../action-review';
import { useContextGuard } from '../action-review';
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, onBeforeRouteLeave } from 'vue-router';
import { Check, Cloud, CloudOff, Timer, ArrowRight, RotateCcw, Play } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import {
  emptyActual,
  workoutDuration,
  type WorkoutSession,
  type WorkoutCommand,
  type WorkoutActual,
  type WorkoutSet,
  type LibraryExercise,
} from '@forma/shared';
import { apiRequest, ApiClientError } from '../api';
import { useStudio } from '../stores/studio';
import {
  cacheWorkout,
  cacheOfflineContext,
  listCachedWorkouts,
  getCachedWorkout,
  workoutKey,
  localWorkout,
  enqueueWorkout,
  syncWorkout,
  setRestDeadline,
  resolveWorkout,
  recheckWorkout,
  type CachedWorkout,
} from '../workout-cache';
import LibraryPreview from './LibraryPreview.vue';
import PageStep from './PageStep.vue';
import { useRoutePanel } from '../route-panel';
const studio = useStudio(),
  route = useRoute(),
  uid = studio.user!.id,
  org = studio.currentOrganization!.id;

const rows = ref<CachedWorkout[]>([]),
  record = ref<CachedWorkout>(),
  index = ref(0),
  error = ref(''),
  busy = ref(false),
  syncing = ref(false),
  now = ref(Date.now()),
  online = ref(navigator.onLine),
  actual = ref<WorkoutActual>(emptyActual()),
  notes = ref(''),
  guide = ref<LibraryExercise | null>(null),
  dirty = ref(false),
  notesDirty = ref(false);
const session = computed(() => (record.value ? localWorkout(record.value) : null)),
  current = computed(() => session.value?.sets[index.value]),
  entry = computed(() =>
    session.value?.prescription.exercises.find((x) => x.id === current.value?.entryId),
  ),
  done = computed(() => session.value?.sets.filter((s) => s.state === 'recorded').length ?? 0),
  remaining = computed(() =>
    Math.max(0, Math.ceil(((record.value?.restDeadline ?? 0) - now.value) / 1000)),
  ),
  duration = computed(() => (session.value ? workoutDuration(session.value, now.value) : 0));
let disposed = false,
  refreshing: Promise<void> | null = null;
const blockedCommand = computed(
  () =>
    record.value?.queue.find((e) => e.clientEventId === record.value?.blocked?.eventId)?.command,
);
const conflictSet = computed(() => {
  const c = blockedCommand.value;
  return c && (c.kind === 'set.save' || c.kind === 'set.undo')
    ? record.value?.base.sets.find((s) => s.entryId === c.entryId && s.setId === c.setId)
    : undefined;
});
const mayApply = computed(
  () =>
    record.value?.blocked?.code === 'SET_CONFLICT' ||
    (record.value?.blocked?.code === 'SESSION_CONFLICT' &&
      blockedCommand.value?.kind !== 'session.start'),
);
function actualText(a: WorkoutActual, metric: string) {
  return `${a.weightKg === null ? '' : `${a.weightKg} kg · `}${a.reps ?? a.seconds ?? a.distanceMeters ?? '—'} ${metric === 'reps' ? 'rep' : metric === 'time' ? 's' : 'm'}${a.note ? ` · ${a.note}` : ''}`;
}
const tick = setInterval(() => {
    now.value = Date.now();
  }, 1000),
  retry = setInterval(() => {
    if (navigator.onLine) void synchronize();
  }, 15000);
function form() {
  const s = current.value;
  if (!s) return;
  actual.value = JSON.parse(JSON.stringify(s.actual));
  if (!notesDirty.value) notes.value = session.value?.notes ?? '';
  dirty.value = notesDirty.value;
}
async function refresh() {
  if (disposed) return;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      rows.value = await listCachedWorkouts(uid, org);
      if (record.value) record.value = await getCachedWorkout(record.value.key);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}
async function select(r: CachedWorkout) {
  if (!(await mayLeave())) return;
  notesDirty.value = false;
  index.value = 0;
  record.value = await getCachedWorkout(r.key);
  form();
  void synchronize();
}
async function perform(task: () => Promise<unknown>) {
  if (busy.value) return;
  error.value = '';
  busy.value = true;
  try {
    await task();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se guardó. Revisa el registro.';
  } finally {
    busy.value = false;
  }
}
async function synchronize() {
  if (!record.value || syncing.value || disposed || !navigator.onLine) return;
  syncing.value = true;
  try {
    await syncWorkout(record.value.key);
    if (error.value.startsWith('No pudimos conectar') || error.value.startsWith('Sin conexión.'))
      error.value = '';
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : 'Sin conexión. Tus registros siguen en este dispositivo.';
  } finally {
    await refresh();
    syncing.value = false;
  }
}
async function command(c: WorkoutCommand, rest?: number) {
  if (!record.value) return;
  await enqueueWorkout(record.value.key, c, rest);
  if (c.kind === 'session.note' || c.kind === 'session.complete') notesDirty.value = false;
  dirty.value = notesDirty.value;
  await refresh();
  form();
  void synchronize();
}
const base = () => ({
  expectedRevision: session.value!.revision,
  clientOccurredAt: new Date().toISOString(),
});
async function save() {
  const s = current.value;
  if (!s) return;
  const a = structuredClone({ ...actual.value });
  for (const k of ['weightKg', 'rpe'] as const) if (String(a[k]) === '') a[k] = null;
  if (
    (s.metric === 'reps' && a.reps === null) ||
    (s.metric === 'time' && a.seconds === null) ||
    (s.metric === 'distance' && a.distanceMeters === null)
  )
    throw new Error('Introduce el valor realizado antes de guardar.');
  await command(
    {
      ...base(),
      kind: 'set.save',
      entryId: s.entryId,
      setId: s.setId,
      expectedRevision: s.revision,
      actual: a,
    },
    s.target.restSeconds,
  );
  const next = session.value!.sets.findIndex((r, i) => i > index.value && r.state !== 'recorded');
  if (next >= 0) {
    index.value = next;
    form();
  }
}
async function move(i: number) {
  if (await mayLeave()) {
    notesDirty.value = false;
    index.value = i;
    form();
  }
}
async function mayLeave() {
  const ok =
    !dirty.value ||
    (await confirmAction(
      'Hay valores escritos que aún no guardaste en este dispositivo. ¿Descartarlos?',
    ));
  return ok;
}
function beforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}
function changed() {
  void refresh();
}
function network() {
  online.value = navigator.onLine;
  void synchronize();
}
async function resolve(choice: 'server' | 'local') {
  if (!record.value) return;
  if (
    choice === 'local' &&
    !(await confirmAction(
      'Enviar tu cambio con la revisión actual del servidor. ¿Aplicar tu registro?',
    ))
  )
    return;
  await resolveWorkout(record.value.key, choice);
  await refresh();
  form();
  void synchronize();
}
function download() {
  if (!record.value) return;
  const blob = new Blob(
      [
        JSON.stringify(
          { format: 'forma-pending-v1', session: record.value.base, events: record.value.queue },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = `forma-registros-${record.value.base.id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function showGuide() {
  const x = entry.value,
    s = x?.snapshot;
  if (!x || !s) return;
  guide.value = {
    id: x.exerciseId,
    ...s,
    media: s.media ?? null,
    equipmentId: null,
    equipmentName: s.equipment?.name ?? null,
    state: 'published',
    version: 1,
    global: false,
    createdAt: '',
    mediaId: s.mediaId,
  };
}
function formatActual(s: WorkoutSet) {
  return `${s.actual.weightKg === null ? '' : `${s.actual.weightKg} kg · `}${s.actual.reps ?? s.actual.seconds ?? s.actual.distanceMeters ?? '—'} ${s.metric === 'reps' ? 'rep' : s.metric === 'time' ? 's' : 'm'}`;
}
watch(
  () => current.value?.setId,
  () => {
    if (!dirty.value) form();
  },
);
onBeforeRouteLeave(async () => await mayLeave());
onMounted(() =>
  perform(async () => {
    window.addEventListener('forma:workouts', changed);
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    window.addEventListener('visibilitychange', network);
    window.addEventListener('beforeunload', beforeUnload);
    await refresh();
    const { assignmentId, weekId, dayId, id } = route.query;
    if (
      typeof assignmentId === 'string' &&
      typeof weekId === 'string' &&
      typeof dayId === 'string'
    ) {
      let data: {
        session: WorkoutSession;
      };
      try {
        data = await apiRequest<{
          session: WorkoutSession;
        }>(`/v1/organizations/${org}/workouts/prepare`, {
          method: 'POST',
          body: { assignmentId, weekId, dayId },
        });
      } catch (e) {
        const cached = rows.value.find(
          (r) =>
            r.base.assignmentId === assignmentId &&
            r.base.weekId === weekId &&
            r.base.dayId === dayId,
        );
        if (e instanceof ApiClientError && e.status === 0 && cached) {
          record.value = cached;
          form();
          return;
        }
        throw e;
      }
      await cacheWorkout(data.session);
      if (studio.portal)
        await cacheOfflineContext({
          user: structuredClone({ ...studio.user! }),
          org: structuredClone({ ...studio.currentOrganization! }),
          brand: JSON.parse(JSON.stringify(studio.brand)),
          portal: JSON.parse(JSON.stringify(studio.portal)),
        });
      await refresh();
      record.value = await getCachedWorkout(workoutKey(uid, org, data.session.id));
    } else if (typeof id === 'string') {
      record.value = await getCachedWorkout(workoutKey(uid, org, id));
      if (navigator.onLine) {
        try {
          const data = await apiRequest<{
            session: WorkoutSession;
          }>(`/v1/organizations/${org}/workouts/${id}`);
          await cacheWorkout(data.session);
          record.value = await getCachedWorkout(workoutKey(uid, org, id));
        } catch (e) {
          if (!record.value) throw e;
        }
      }
    } else
      record.value =
        rows.value.find((r) => localWorkout(r).state === 'in_progress') ?? rows.value[0];
    form();
    void synchronize();
  }),
);
onBeforeUnmount(() => {
  disposed = true;
  clearInterval(tick);
  clearInterval(retry);
  window.removeEventListener('forma:workouts', changed);
  window.removeEventListener('online', network);
  window.removeEventListener('offline', network);
  window.removeEventListener('visibilitychange', network);
  window.removeEventListener('beforeunload', beforeUnload);
});
const correction = ref<{ open: true } | null>(null),
  correctionReason = ref('');
useRoutePanel(
  'correction',
  correction,
  () => 'reason',
  () => ({ open: true }),
);
useRoutePanel(
  'movement',
  guide,
  (value) => value.id,
  () => null,
);
async function reopen() {
  await command({ ...base(), kind: 'session.reopen', reason: correctionReason.value });
  correction.value = null;
  correctionReason.value = '';
}
useContextGuard(mayLeave);
</script>
<template>
  <div v-show="!guide && !correction" class="workout-page">
    <header class="workout-heading">
      <div>
        <h1>Entrenar</h1>
        <p v-if="session" class="muted">{{ session.programName }}</p>
      </div>
      <RouterLink to="/historial" class="text-link"
        >Mi historial <ArrowRight :size="16"
      /></RouterLink>
    </header>
    <div v-if="studio.offlineMode" class="program-notice">
      Contexto sin conexión · el acceso se verificará al sincronizar. Solo están disponibles los
      entrenamientos preparados.
      <UiButton
        v-if="online"
        variant="secondary"
        :disabled="busy"
        @click="
          async () => {
            perform(async () => {
              if (await mayLeave()) await studio.refresh();
            });
          }
        "
        >Actualizar acceso</UiButton
      >
    </div>
    <p v-if="error" role="alert" class="form-error">{{ error }}</p>
    <div v-if="!session" class="ui-card empty-state">
      <h2>Sin entrenamiento abierto</h2>
      <p>Elige un día de tu programa para comenzar.</p>
      <RouterLink to="/mi-programa" class="hero-button"
        >Elegir entrenamiento <ArrowRight :size="18"
      /></RouterLink>
    </div>
    <template v-else-if="record">
      <div class="workout-sync" role="status">
        <component :is="online ? Cloud : CloudOff" :size="18" /><span>{{
          record.queue.length
            ? `${record.queue.length} cambio(s) guardados en este dispositivo · ${syncing ? 'sincronizando…' : online ? 'pendientes de confirmación' : 'sin conexión'}`
            : 'Todos los cambios confirmados por el servidor'
        }}</span
        ><UiButton
          v-if="record.queue.length"
          variant="ghost"
          :disabled="syncing || !online || !!record.blocked"
          @click="synchronize"
          >Reintentar</UiButton
        >
      </div>
      <section v-if="record.blocked" class="workout-conflict" role="alert">
        <h2>Revisa un cambio antes de continuar.</h2>
        <p>Los cambios pendientes se conservan en este dispositivo.</p>
        <template
          v-if="['SET_CONFLICT', 'SESSION_CONFLICT', 'WORKOUT_STATE'].includes(record.blocked.code)"
          ><p>
            Otro dispositivo o un cambio de estado impide aplicar automáticamente el primer cambio.
          </p>
          <div class="workout-conflict-values">
            <p>
              <strong>Confirmado por el servidor:</strong>
              {{
                conflictSet
                  ? actualText(conflictSet.actual, conflictSet.metric)
                  : record.base.notes || record.base.state
              }}
            </p>
            <p>
              <strong>Tu cambio pendiente:</strong>
              {{
                blockedCommand?.kind === 'set.save'
                  ? actualText(blockedCommand.actual, conflictSet?.metric ?? 'reps')
                  : blockedCommand?.kind === 'session.note' ||
                      blockedCommand?.kind === 'session.complete'
                    ? blockedCommand.notes
                    : blockedCommand?.kind === 'set.undo'
                      ? 'Deshacer esta serie'
                      : 'Cambiar estado de la sesión'
              }}
            </p>
          </div>
          <div class="workout-actions">
            <UiButton variant="secondary" :disabled="busy" @click="perform(() => resolve('server'))"
              >Descartar solo este cambio</UiButton
            ><UiButton v-if="mayApply" :disabled="busy" @click="perform(() => resolve('local'))"
              >Aplicar mi registro</UiButton
            >
          </div></template
        ><template v-else
          ><p>
            Conecta con la misma cuenta o consulta a tu coach. Una asignación cancelada no admite
            nuevos cambios.
          </p>
          <UiButton
            v-if="record.blocked.code !== 'WORKOUT_ACCESS_REVOKED'"
            variant="secondary"
            @click="
              perform(async () => {
                await recheckWorkout(record!.key);
                await refresh();
                void synchronize();
              })
            "
            >Volver a verificar acceso</UiButton
          ></template
        ><UiButton variant="ghost" @click="download">Descargar registros pendientes</UiButton>
      </section>
      <div class="workout-layout">
        <aside class="ui-card workout-outline">
          <span class="eyebrow">{{ session.scheduledOn }} · {{ session.weekName }}</span>
          <h2>{{ session.prescription.name }}</h2>
          <p>{{ done }} de {{ session.sets.length }} series registradas</p>
          <progress
            :value="done"
            :max="session.sets.length || 1"
            :aria-label="`${done} series registradas`"
          />
          <nav aria-label="Series del entrenamiento">
            <button
              v-for="(s, i) in session.sets"
              :key="s.entryId + s.setId"
              :class="{ active: i === index, recorded: s.state === 'recorded' }"
              @click="
                async () => {
                  await move(i);
                }
              "
            >
              <span>{{ String(i + 1).padStart(2, '0') }}</span
              ><span
                >{{ session.prescription.exercises.find((x) => x.id === s.entryId)?.snapshot?.name
                }}<small>{{
                  s.state === 'recorded' ? formatActual(s) : 'Por registrar'
                }}</small></span
              ><Check v-if="s.state === 'recorded'" :size="18" />
            </button>
          </nav>
          <p class="muted small-text">
            Tiempo declarado: {{ Math.floor(duration / 60) }} min {{ duration % 60 }} s
          </p>
        </aside>
        <main class="workout-main">
          <section v-if="session.state === 'planned'" class="ui-card workout-start">
            <h2>{{ session.prescription.name }}</h2>
            <p v-if="session.prescription.notes">{{ session.prescription.notes }}</p>
            <UiButton
              :disabled="busy || !session.accessActive"
              @click="perform(() => command({ ...base(), kind: 'session.start' }))"
              ><Play :size="18" />Iniciar sesión</UiButton
            >
          </section>
          <section
            v-if="session.state === 'in_progress' && current && entry"
            class="ui-card workout-current"
          >
            <header>
              <span class="eyebrow">SERIE {{ index + 1 }} DE {{ session.sets.length }}</span>
              <h2>{{ entry.snapshot?.name }}</h2>
              <p class="muted">
                {{ entry.snapshot?.muscle }} ·
                {{
                  entry.snapshot?.equipment?.name || entry.snapshot?.equipmentTag || 'Sin material'
                }}
              </p>
            </header>
            <p class="program-instructions">{{ entry.snapshot?.instructions }}</p>
            <p v-if="entry.notes" class="program-day-note">{{ entry.notes }}</p>
            <UiButton variant="ghost" @click="showGuide">Ver guía y medio</UiButton>
            <div class="workout-target">
              <span>OBJETIVO DEL COACH</span
              ><strong
                >{{
                  current.metric === 'reps'
                    ? `${current.target.repsMin}–${current.target.repsMax} rep`
                    : current.metric === 'time'
                      ? `${current.target.seconds} s`
                      : `${current.target.distanceMeters} m`
                }}<template v-if="current.target.weightKg !== null">
                  · {{ current.target.weightKg }} kg</template
                ></strong
              ><small
                >Descanso {{ current.target.restSeconds }} s ·
                {{
                  current.target.rpe === null
                    ? 'Esfuerzo libre'
                    : `Esfuerzo ${current.target.rpe}/10`
                }}</small
              >
            </div>
            <p v-if="record.base.sets[index]?.state === 'recorded'" class="small-text">
              Último confirmado de esta serie: {{ formatActual(record.base.sets[index]!) }}
            </p>
            <form class="workout-record-form" @submit.prevent="perform(save)" @input="dirty = true">
              <h3>Lo que hiciste</h3>
              <div class="workout-numbers">
                <label class="field"
                  >Carga (kg, opcional)<input
                    v-model.number="actual.weightKg"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    max="1000"
                    step="0.01"
                    @change="
                      actual.weightKg =
                        actual.weightKg == null || String(actual.weightKg) === ''
                          ? null
                          : actual.weightKg
                    " /></label
                ><label v-if="current.metric === 'reps'" class="field"
                  >Repeticiones<input
                    v-model.number="actual.reps"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    max="999"
                    step="1"
                    required /></label
                ><label v-if="current.metric === 'time'" class="field"
                  >Tiempo (segundos)<input
                    v-model.number="actual.seconds"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    max="86400"
                    step="1"
                    required /></label
                ><label v-if="current.metric === 'distance'" class="field"
                  >Distancia (metros)<input
                    v-model.number="actual.distanceMeters"
                    type="number"
                    inputmode="decimal"
                    min="1"
                    max="100000"
                    step="0.01"
                    required /></label
                ><label class="field"
                  >Esfuerzo (1–10, opcional)<input
                    v-model.number="actual.rpe"
                    type="number"
                    inputmode="decimal"
                    min="1"
                    max="10"
                    step="0.5"
                    @change="
                      actual.rpe =
                        actual.rpe == null || String(actual.rpe) === '' ? null : actual.rpe
                    "
                /></label>
              </div>
              <label class="field"
                >Nota de esta serie<textarea
                  v-model="actual.note"
                  maxlength="500"
                  rows="2"
                  placeholder="Cómo te sentiste, técnica o ajustes…"
                />
              </label>
              <div class="workout-save-bar">
                <UiButton
                  type="submit"
                  :disabled="busy || !!record.blocked || !session.accessActive"
                  ><Check :size="19" />{{
                    busy
                      ? 'Guardando…'
                      : current.state === 'recorded'
                        ? 'Actualizar serie'
                        : 'Guardar serie'
                  }}</UiButton
                ><UiButton
                  v-if="current.state === 'recorded'"
                  variant="secondary"
                  :disabled="busy || !!record.blocked"
                  @click="
                    perform(() =>
                      command({
                        ...base(),
                        kind: 'set.undo',
                        entryId: current!.entryId,
                        setId: current!.setId,
                        expectedRevision: current!.revision,
                      }),
                    )
                  "
                  ><RotateCcw :size="16" />Deshacer</UiButton
                >
              </div>
              <small class="muted"
                >Se guarda primero en este dispositivo. Espera la confirmación del servidor antes de
                cerrar sesión.</small
              >
            </form>
          </section>
          <section v-if="session.state === 'in_progress'" class="ui-card workout-rest">
            <Timer :size="26" />
            <div>
              <span class="eyebrow">DESCANSO</span
              ><strong>{{
                remaining
                  ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
                  : 'A tu ritmo'
              }}</strong>
            </div>
            <UiButton variant="ghost" @click="perform(() => setRestDeadline(record!.key, null))"
              >Terminar descanso</UiButton
            >
          </section>
          <section class="ui-card workout-finish">
            <h2>
              {{ session.state === 'completed' ? 'Sesión registrada' : 'Finalizar sesión' }}
            </h2>
            <p>
              {{ done }}/{{ session.sets.length }} series · {{ Math.floor(duration / 60) }} minutos
              declarados
            </p>
            <template v-if="session.state === 'in_progress'"
              ><label class="field"
                >Notas de la sesión<textarea
                  v-model="notes"
                  maxlength="1500"
                  rows="3"
                  @input="
                    dirty = true;
                    notesDirty = true;
                  "
                />
              </label>
              <div class="workout-actions">
                <UiButton
                  variant="secondary"
                  :disabled="busy || !!record.blocked"
                  @click="
                    perform(() =>
                      command({
                        ...base(),
                        kind: 'session.note',
                        expectedRevision: session!.notesRevision,
                        notes,
                      }),
                    )
                  "
                  >Guardar notas</UiButton
                ><UiButton
                  :disabled="busy || !done || !!record.blocked"
                  @click="
                    async () => {
                      perform(async () => {
                        if (
                          done < session!.sets.length &&
                          !(await confirmAction(
                            'Quedan series sin registrar. ¿Finalizar como sesión parcial?',
                          ))
                        )
                          return;
                        await command({
                          ...base(),
                          kind: 'session.complete',
                          notes,
                          durationSeconds: duration,
                          allowPartial: done < session!.sets.length,
                        });
                      });
                    }
                  "
                  >Finalizar sesión <ArrowRight :size="17"
                /></UiButton></div></template
            ><template v-else-if="session.state === 'completed'"
              ><p v-if="session.notes">{{ session.notes }}</p>
              <UiButton
                variant="secondary"
                :disabled="busy || !!record.blocked || !session.accessActive"
                @click="correction = { open: true }"
                >Corregir registro con motivo</UiButton
              ></template
            >
          </section>
        </main>
      </div>
    </template>
    <section v-if="rows.length > 1" class="workout-other">
      <h2>En este dispositivo</h2>
      <div class="workout-saved-grid">
        <button
          v-for="r in rows"
          :key="r.key"
          class="ui-card workout-session-link"
          @click="select(r)"
        >
          <strong>{{ r.base.prescription.name }}</strong
          ><span
            >{{ r.base.scheduledOn }} ·
            {{ localWorkout(r).state === 'completed' ? 'Finalizada' : 'Preparada' }} ·
            {{ r.queue.length }} pendientes</span
          >
        </button>
      </div>
    </section>
  </div>
  <PageStep
    v-if="correction"
    title="Corregir registro"
    back-label="Entrenamiento"
    @back="correction = null"
  >
    <form @submit.prevent="perform(reopen)">
      <label class="field"
        >Motivo de la corrección
        <textarea v-model="correctionReason" required minlength="3" maxlength="200" rows="3" />
      </label>
      <p class="small-text muted">Disponible durante siete días desde el cierre.</p>
      <p v-if="error" role="alert" class="form-error">{{ error }}</p>
      <UiButton type="submit" :disabled="busy">Reabrir sesión</UiButton>
    </form>
  </PageStep>
  <LibraryPreview
    v-if="guide"
    :organization-id="org"
    :exercise="guide"
    :staff="false"
    @close="guide = null"
  />
</template>
