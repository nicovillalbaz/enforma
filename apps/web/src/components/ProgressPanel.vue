<script setup lang="ts">
import { confirmAction } from '../action-review';
import { useContextGuard } from '../action-review';
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import {
  TrendingUp,
  Activity,
  CalendarCheck,
  Scale,
  Camera,
  ShieldCheck,
  ArrowRight,
  Plus,
} from '@lucide/vue';
import PageStep from './PageStep.vue';
import { useRoutePanel } from '../route-panel';
import { UiButton } from '@forma/ui';
import {
  adherence,
  percentageChange,
  measurementKinds,
  dateAt,
  type MeasurementKind,
  type ProgressMetrics,
  type BodyMeasurement,
  type ProgressPhoto,
  type ProgressPrivacy,
} from '@forma/shared';
import { apiRequest, ApiClientError } from '../api';
import { useStudio } from '../stores/studio';
import ProgressChart from './ProgressChart.vue';
const props = defineProps<{
    studentId: string;
    compact?: boolean;
  }>(),
  studio = useStudio(),
  route = useRoute(),
  org = studio.currentOrganization!.id,
  learner = computed(() => studio.currentOrganization?.role === 'student'),
  root = computed(() => `/v1/organizations/${org}/progress/${props.studentId}`);
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Asuncion',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const from = ref(dateAt(today, -27)),
  to = ref(today),
  metrics = ref<ProgressMetrics>(),
  tab = ref<'training' | 'measurements' | 'photos' | 'privacy'>(
    route.query.tab === 'measurements' ? 'measurements' : 'training',
  ),
  error = ref(''),
  busy = ref(false),
  loading = ref(false),
  exercise = ref(''),
  kind = ref<MeasurementKind>('weight'),
  measurements = ref<BodyMeasurement[]>([]),
  measurementPoints = ref<
    {
      date: string;
      value: number;
    }[]
  >([]),
  measurementCursor = ref<string | null>(null),
  photos = ref<ProgressPhoto[]>([]),
  photoCursor = ref<string | null>(null),
  privacy = ref<ProgressPrivacy>(),
  privacyDirty = ref(false),
  value = ref<number | string>(''),
  measuredOn = ref(today),
  correcting = ref<BodyMeasurement | null>(null),
  correctionValue = ref<number | string>(''),
  correctionDate = ref(today),
  correctionReason = ref(''),
  photoDate = ref(today),
  caption = ref(''),
  file = ref<File>(),
  selectedPhoto = ref<ProgressPhoto | null>(null),
  days = ref(14),
  alertEnabled = ref(true);
let epoch = 0,
  disposed = false,
  measurementRequest = crypto.randomUUID(),
  photoRequest = crypto.randomUUID(),
  lastMeasurementBody = '',
  correctionRequest = crypto.randomUUID(),
  lastPhotoBody = '';
const summary = computed(() => metrics.value?.summary),
  completion = computed(() =>
    summary.value ? adherence(summary.value.completedDays, summary.value.expectedDays) : null,
  ),
  comparison = computed(() =>
    metrics.value
      ? percentageChange(
          metrics.value.comparison.last7Volume,
          metrics.value.comparison.previous7Volume,
        )
      : null,
  );
const selectedExercise = computed(() =>
    metrics.value?.exercises.find((e) => e.exerciseId + '/' + e.metric === exercise.value),
  ),
  exercisePoints = computed(
    () =>
      metrics.value?.trend
        .filter(
          (p) =>
            p.exerciseId === selectedExercise.value?.exerciseId &&
            p.metric === selectedExercise.value.metric,
        )
        .map((p) => ({
          label: p.date,
          value:
            p.metric === 'reps'
              ? p.bestLoadKg
              : p.metric === 'time'
                ? p.bestSeconds
                : p.bestDistanceMeters,
        })) ?? [],
  );
const number = (n: number) =>
    new Intl.NumberFormat('es-PY', { maximumFractionDigits: 2 }).format(n),
  fmtDate = (s: string | null) =>
    s
      ? new Intl.DateTimeFormat('es-PY', {
          dateStyle: 'medium',
          timeZone: 'America/Asuncion',
        }).format(new Date(s))
      : 'Sin sesión finalizada';
async function perform(fn: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await fn();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos completar la acción.';
  } finally {
    busy.value = false;
  }
}
async function load(keepView = false) {
  if (privacyDirty.value && !(await mayLeave())) return;
  privacyDirty.value = false;
  const token = ++epoch;
  loading.value = true;
  error.value = '';
  if (!keepView) metrics.value = undefined;
  measurements.value = [];
  measurementPoints.value = [];
  photos.value = [];
  selectedPhoto.value = null;
  try {
    const data = await apiRequest<{
      metrics: ProgressMetrics;
    }>(`${root.value}?${new URLSearchParams({ from: from.value, to: to.value })}`);
    if (disposed || token !== epoch) return;
    metrics.value = data.metrics;
    days.value = data.metrics.activity.thresholdDays;
    alertEnabled.value = data.metrics.activity.enabled;
    if (!data.metrics.exercises.some((e) => e.exerciseId + '/' + e.metric === exercise.value))
      exercise.value = data.metrics.exercises[0]
        ? data.metrics.exercises[0].exerciseId + '/' + data.metrics.exercises[0].metric
        : '';
    if (!props.compact) await loadTab();
  } catch (e) {
    if (token === epoch) {
      metrics.value = undefined;
      error.value = e instanceof Error ? e.message : 'No pudimos consultar el progreso.';
    }
  } finally {
    if (token === epoch) loading.value = false;
  }
}
async function loadPrivacy() {
  const token = epoch,
    url = root.value;
  const data = await apiRequest<{
    privacy: ProgressPrivacy;
  }>(url + '/privacy');
  if (disposed || token !== epoch || url !== root.value) return;
  privacy.value = data.privacy;
  privacyDirty.value = false;
}
async function loadMeasurements(more = false) {
  if (!metrics.value?.access.measurements) return;
  const token = epoch,
    url = root.value,
    selectedKind = kind.value;
  const q = new URLSearchParams({
    kind: kind.value,
    from: from.value,
    to: to.value,
    limit: '30',
    ...(more && measurementCursor.value ? { cursor: measurementCursor.value } : {}),
  });
  const [history, trend] = await Promise.all([
    apiRequest<{
      measurements: BodyMeasurement[];
      nextCursor: string | null;
    }>(root.value + '/measurements?' + q),
    apiRequest<{
      points: {
        date: string;
        value: number;
      }[];
    }>(
      root.value +
        '/measurements/trend?' +
        new URLSearchParams({ kind: kind.value, from: from.value, to: to.value }),
    ),
  ]);
  if (disposed || token !== epoch || url !== root.value || selectedKind !== kind.value) return;
  measurements.value = more
    ? [...measurements.value, ...history.measurements]
    : history.measurements;
  measurementCursor.value = history.nextCursor;
  measurementPoints.value = trend.points;
}
async function loadPhotos(more = false) {
  if (!metrics.value?.access.photos) return;
  const token = epoch,
    url = root.value;
  const data = await apiRequest<{
    photos: ProgressPhoto[];
    nextCursor: string | null;
  }>(
    root.value +
      '/photos?limit=12' +
      (more && photoCursor.value ? '&cursor=' + photoCursor.value : ''),
  );
  if (disposed || token !== epoch || url !== root.value) return;
  photos.value = more ? [...photos.value, ...data.photos] : data.photos;
  photoCursor.value = data.nextCursor;
}
async function loadTab() {
  error.value = '';
  try {
    if (tab.value === 'privacy' && learner.value) await loadPrivacy();
    if (tab.value === 'measurements') await loadMeasurements();
    if (tab.value === 'photos') await loadPhotos();
  } catch (e) {
    measurements.value = [];
    measurementPoints.value = [];
    photos.value = [];
    selectedPhoto.value = null;
    if (e instanceof ApiClientError && e.status === 403 && metrics.value) {
      if (tab.value === 'photos') metrics.value.access.photos = false;
      if (tab.value === 'measurements') metrics.value.access.measurements = false;
    }
    error.value = e instanceof Error ? e.message : 'No pudimos consultar estos datos.';
  }
}
async function switchTab(next: typeof tab.value) {
  if (!(await mayLeave())) return;
  privacyDirty.value = false;
  tab.value = next;
  await loadTab();
}
async function mayLeave() {
  return (
    !privacyDirty.value ||
    (await confirmAction('Hay permisos sin guardar. ¿Descartar esos cambios?'))
  );
}
function beforeUnload(e: BeforeUnloadEvent) {
  if (privacyDirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}
function visibility() {
  if (document.visibilityState === 'visible' && !privacyDirty.value) void load(true);
}
async function saveMeasurement() {
  const body = { kind: kind.value, value: value.value, measuredOn: measuredOn.value };
  const fingerprint = JSON.stringify(body);
  if (fingerprint !== lastMeasurementBody) {
    measurementRequest = crypto.randomUUID();
    lastMeasurementBody = fingerprint;
  }
  await apiRequest(root.value + '/measurements', {
    method: 'POST',
    body: { ...body, requestId: measurementRequest },
  });
  measurementRequest = crypto.randomUUID();
  lastMeasurementBody = '';
  value.value = '';
  await loadMeasurements();
  studio.notify('Medición confirmada.');
}
function openCorrection(m: BodyMeasurement) {
  correcting.value = m;
  correctionValue.value = m.value;
  correctionDate.value = m.measuredOn;
  correctionReason.value = '';
  correctionRequest = crypto.randomUUID();
}
async function correctMeasurement() {
  if (!correcting.value) return;
  await apiRequest(root.value + `/measurements/${correcting.value.id}/correct`, {
    method: 'POST',
    body: {
      requestId: correctionRequest,
      value: Number(correctionValue.value),
      measuredOn: correctionDate.value,
      reason: correctionReason.value,
    },
  });
  correcting.value = null;
  await loadMeasurements();
  studio.notify('Corrección guardada. El valor anterior sigue en el historial.');
}
async function voidMeasurement() {
  if (!correcting.value) return;
  await apiRequest(root.value + `/measurements/${correcting.value.id}/void`, {
    method: 'POST',
    body: { reason: correctionReason.value },
  });
  correcting.value = null;
  await loadMeasurements();
}
function pickFile(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0];
  photoRequest = crypto.randomUUID();
}
async function uploadPhoto() {
  if (!file.value) throw new Error('Selecciona una imagen.');
  if (file.value.size > 2097152) throw new Error('Selecciona una imagen de hasta 2 MB.');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No pudimos leer el archivo.'));
    reader.readAsDataURL(file.value!);
  });
  const body = { measuredOn: photoDate.value, caption: caption.value, dataUrl };
  const fingerprint = JSON.stringify(body);
  if (fingerprint !== lastPhotoBody) {
    photoRequest = crypto.randomUUID();
    lastPhotoBody = fingerprint;
  }
  await apiRequest(root.value + '/photos', {
    method: 'POST',
    body: { ...body, requestId: photoRequest },
  });
  photoRequest = crypto.randomUUID();
  lastPhotoBody = '';
  caption.value = '';
  file.value = undefined;
  await loadPhotos();
  studio.notify('Foto privada confirmada.');
}
async function savePrivacy() {
  if (!privacy.value) return;
  if (
    !privacy.value.photoConsent &&
    metrics.value?.access.photos &&
    !(await confirmAction(
      'Retirar el consentimiento ocultará y eliminará todas tus fotos activas. ¿Continuar?',
    ))
  )
    return;
  const p = privacy.value;
  await apiRequest(root.value + '/privacy', {
    method: 'PUT',
    body: {
      revision: p.revision,
      photoConsent: p.photoConsent,
      professionals: p.professionals.map((g) => ({
        id: g.id,
        measurements: g.measurements,
        photos: p.photoConsent && g.photos,
      })),
    },
  });
  privacyDirty.value = false;
  photos.value = [];
  await load();
  studio.notify('Privacidad actualizada.');
}
async function openPhoto(p: ProgressPhoto) {
  selectedPhoto.value = p;
}
async function deletePhoto(p: ProgressPhoto) {
  if (
    !(await confirmAction(
      '¿Eliminar esta foto de progreso? Dejará de estar disponible para ti y tus profesionales.',
    ))
  )
    return;
  await apiRequest(root.value + `/photos/${p.id}`, { method: 'DELETE' });
  selectedPhoto.value = null;
  await loadPhotos();
}
async function saveAlert() {
  await apiRequest(root.value + '/alert', {
    method: 'PUT',
    body: {
      revision: metrics.value!.activity.revision,
      days: days.value,
      enabled: alertEnabled.value,
    },
  });
  await load();
  studio.notify('Aviso de inactividad actualizado.');
}
onBeforeRouteLeave(async () => await mayLeave());
onMounted(() => {
  void load();
  window.addEventListener('beforeunload', beforeUnload);
  document.addEventListener('visibilitychange', visibility);
});
onBeforeUnmount(() => {
  disposed = true;
  epoch++;
  window.removeEventListener('beforeunload', beforeUnload);
  document.removeEventListener('visibilitychange', visibility);
});
watch(
  () => props.studentId,
  () => void load(),
);
useContextGuard(mayLeave);
useRoutePanel(
  'photo',
  selectedPhoto,
  (p) => p.id,
  async (id) => {
    await load();
    return photos.value.find((p) => p.id === id) ?? null;
  },
);
</script>
<template>
  <section v-show="!selectedPhoto" class="progress-panel">
    <header class="progress-heading">
      <div>
        <h1 v-if="!compact">
          {{ learner ? 'Mi progreso' : metrics?.studentName || 'Progreso del alumno' }}
        </h1>
        <h3 v-else>Seguimiento del entrenamiento</h3>
      </div>
      <RouterLink
        :to="{ path: '/historial', query: learner ? {} : { studentId } }"
        class="text-link"
        >Historial de sesiones <ArrowRight :size="17"
      /></RouterLink>
    </header>
    <form
      v-if="!compact && (tab === 'training' || tab === 'measurements')"
      class="progress-filters"
      @submit.prevent="perform(load)"
    >
      <label class="field">Desde<input v-model="from" type="date" :max="to" required /></label
      ><label class="field"
        >Hasta<input v-model="to" type="date" :min="from" :max="today" required /></label
      ><UiButton type="submit" variant="secondary" :disabled="busy || loading"
        >Aplicar periodo</UiButton
      >
    </form>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="loading" role="status">Cargando progreso…</p>
    <template v-if="metrics && summary">
      <div v-if="compact || tab === 'training'" class="progress-metrics">
        <article class="ui-card progress-metric">
          <span class="progress-metric-icon"><CalendarCheck :size="20" /></span
          ><span>Días completados</span
          ><strong
            >{{ summary.completedDays }}<small> / {{ summary.expectedDays }}</small></strong
          >
          <p>{{ completion === null ? 'Sin días exigibles' : `${completion}% de cumplimiento` }}</p>
        </article>
        <article class="ui-card progress-metric">
          <span class="progress-metric-icon"><Activity :size="20" /></span
          ><span>Sesiones finalizadas</span><strong>{{ summary.sessions }}</strong>
          <p>{{ summary.partialSessions }} parciales · {{ summary.inProgress }} en curso</p>
        </article>
        <article class="ui-card progress-metric">
          <span class="progress-metric-icon"><TrendingUp :size="20" /></span
          ><span>Volumen conocido</span
          ><strong>{{ number(summary.volumeKgReps) }}<small> kg·rep</small></strong>
          <p>{{ summary.recordedSets }} series · {{ summary.unweightedSets }} sin carga indicada</p>
        </article>
      </div>
      <p v-if="compact" class="muted">
        Último cierre: {{ fmtDate(metrics.activity.lastCompletedAt) }}.
        <span v-if="metrics.activity.flagged"
          >Revisar inactividad: {{ metrics.activity.daysInactive }} días.</span
        >
      </p>
      <RouterLink v-if="compact" class="text-link" :to="{ path: '/progreso', query: { studentId } }"
        >Abrir progreso y mediciones →</RouterLink
      >
      <template v-else>
        <nav class="progress-tabs" aria-label="Secciones de progreso">
          <button :class="{ active: tab === 'training' }" @click="switchTab('training')">
            <TrendingUp :size="17" />Entrenamiento</button
          ><button :class="{ active: tab === 'measurements' }" @click="switchTab('measurements')">
            <Scale :size="17" />Mediciones</button
          ><button :class="{ active: tab === 'photos' }" @click="switchTab('photos')">
            <Camera :size="17" />Fotos</button
          ><button
            v-if="learner"
            :class="{ active: tab === 'privacy' }"
            @click="switchTab('privacy')"
          >
            <ShieldCheck :size="17" />Privacidad
          </button>
        </nav>
        <template v-if="tab === 'training'"
          ><section class="progress-context">
            <p>
              <strong>{{ summary.missedDays }}</strong> días anteriores sin finalizar ·
              <strong>{{ summary.todayPending }}</strong> pendientes hoy ·
              <strong>{{ summary.cancelledDays }}</strong> días cancelados excluidos.
            </p>
            <details class="progress-method-details">
              <summary>Cómo se calcula</summary>
              <p class="small-text muted">
                Se usa la fecha programada en Paraguay. No se incluyen cambios pendientes ni
                sesiones reabiertas. Si el periodo tiene menos de 14 días, la comparación puede ser
                parcial. Las cargas no indicadas no se estiman.
              </p>
            </details>
          </section>
          <div class="progress-chart-grid">
            <article class="ui-card">
              <ProgressChart
                title="Volumen por semana"
                unit="kg·rep"
                :zero="true"
                :points="metrics.weekly.map((w) => ({ label: w.week, value: w.volumeKgReps }))"
              />
            </article>
            <article class="ui-card progress-comparison">
              <h2>Últimos 7 días</h2>
              <strong>{{ number(metrics.comparison.last7Volume) }} <small>kg·rep</small></strong>
              <div>
                <span>Anteriores siete días</span
                ><b>{{ number(metrics.comparison.previous7Volume) }} kg·rep</b>
              </div>
              <p>
                {{
                  comparison === null
                    ? 'Sin una base anterior para calcular porcentaje.'
                    : `${comparison > 0 ? '+' : ''}${comparison}% frente a la ventana anterior.`
                }}
              </p>
            </article>
          </div>
          <article class="ui-card progress-exercise">
            <header>
              <h2>Por ejercicio</h2>
            </header>
            <label class="field"
              >Ejercicio<select v-model="exercise">
                <option value="">Selecciona un ejercicio</option>
                <option
                  v-for="e in metrics.exercises"
                  :key="e.exerciseId + e.metric"
                  :value="e.exerciseId + '/' + e.metric"
                >
                  {{ e.name }} ·
                  {{
                    e.metric === 'reps'
                      ? 'repeticiones'
                      : e.metric === 'time'
                        ? 'tiempo'
                        : 'distancia'
                  }}
                </option>
              </select></label
            ><template v-if="selectedExercise"
              ><div class="progress-record">
                <span>Máximo registrado en el periodo</span
                ><strong>{{
                  selectedExercise.metric === 'reps'
                    ? selectedExercise.bestLoadKg === null
                      ? 'Sin carga indicada'
                      : `${number(selectedExercise.bestLoadKg)} kg · ${selectedExercise.bestLoadReps} rep`
                    : selectedExercise.metric === 'time'
                      ? `${selectedExercise.bestSeconds} s`
                      : `${selectedExercise.bestDistanceMeters} m`
                }}</strong>
              </div>
              <ProgressChart
                :title="selectedExercise.name"
                :unit="
                  selectedExercise.metric === 'reps'
                    ? 'kg'
                    : selectedExercise.metric === 'time'
                      ? 's'
                      : 'm'
                "
                :points="exercisePoints"
            /></template>
            <p v-else class="empty-state">
              Finaliza una sesión para empezar a ver tus registros por ejercicio.
            </p>
          </article>
          <section class="ui-card progress-activity">
            <h2>Último entrenamiento</h2>
            <p>{{ fmtDate(metrics.activity.lastCompletedAt) }}</p>
            <p v-if="!learner && metrics.activity.flagged" class="progress-flag">
              Sin cierre reciente: {{ metrics.activity.daysInactive }} días. Puedes revisar su
              planificación.
            </p>
            <form v-if="!learner" class="progress-alert-form" @submit.prevent="perform(saveAlert)">
              <label class="checkbox-field"
                ><input v-model="alertEnabled" type="checkbox" />Mostrar aviso de inactividad</label
              ><label class="field"
                >Días sin finalizar sesión<input
                  v-model.number="days"
                  type="number"
                  inputmode="numeric"
                  min="7"
                  max="90"
                  required /></label
              ><UiButton type="submit" variant="secondary" :disabled="busy">Guardar aviso</UiButton
              ><small class="muted"
                >Solo para tu seguimiento. No envía mensajes ni cambia el acceso del alumno.</small
              >
            </form>
          </section>
          <details class="progress-method">
            <summary>Cómo se calcula el progreso</summary>
            <p>
              Una sesión parcial cuenta si tiene al menos una serie confirmada. El cumplimiento
              cuenta fechas distintas, para no duplicar un día al reemplazar un plan. Cargas cero
              aportan cero; las no indicadas no se estiman. Tiempo y distancia mantienen sus propias
              unidades. Las marcas son valores realizados dentro del periodo, no recomendaciones.
            </p>
          </details></template
        >
        <template v-if="tab === 'measurements'"
          ><RouterLink
            class="text-link"
            :to="{
              path: '/antropometria',
              query: learner ? {} : { studentId, from: '/alumnos/' + studentId },
            }"
            >Evaluaciones antropométricas →</RouterLink
          >
          <div v-if="!metrics.access.measurements" class="ui-card progress-private">
            <ShieldCheck :size="30" />
            <h2>Mediciones privadas.</h2>
            <p>No tienes acceso a estas mediciones.</p>
          </div>
          <template v-else
            ><div class="progress-chart-grid">
              <article class="ui-card">
                <label class="field"
                  >Medición<select v-model="kind" @change="perform(() => loadMeasurements())">
                    <option v-for="(k, id) in measurementKinds" :key="id" :value="id">
                      {{ k.label }} ({{ k.unit }})
                    </option>
                  </select></label
                ><ProgressChart
                  :title="measurementKinds[kind].label"
                  :unit="measurementKinds[kind].unit"
                  :points="measurementPoints.map((p) => ({ label: p.date, value: p.value }))"
                />
                <p class="small-text muted">
                  Última medición válida de cada fecha. Los valores anulados no se grafican.
                </p>
              </article>
              <form class="ui-card progress-entry" @submit.prevent="perform(saveMeasurement)">
                <h2>Añadir {{ measurementKinds[kind].label.toLowerCase() }}</h2>
                <label class="field"
                  >Valor ({{ measurementKinds[kind].unit }})<input
                    v-model.number="value"
                    type="number"
                    inputmode="decimal"
                    min="0.01"
                    :max="measurementKinds[kind].max"
                    step="0.01"
                    required /></label
                ><label class="field"
                  >Fecha de medición<input v-model="measuredOn" type="date" :max="today" required
                /></label>
                <UiButton type="submit" :disabled="busy"
                  ><Plus :size="17" />Guardar medición</UiButton
                >
              </form>
            </div>
            <section class="ui-card progress-history">
              <h2>Historial de {{ measurementKinds[kind].label.toLowerCase() }}</h2>
              <p v-if="!measurements.length" class="empty-state">
                No hay mediciones de este tipo en el periodo.
              </p>
              <article v-for="m in measurements" :key="m.id" class="progress-measurement-row">
                <div>
                  <strong>{{ number(m.value) }} {{ m.unit }}</strong
                  ><span>{{ m.measuredOn }} · {{ m.source === 'self' ? 'Alumno' : 'Coach' }}</span
                  ><small v-if="m.voidedAt">Anulada: {{ m.voidReason }}</small>
                </div>
                <UiButton
                  v-if="
                    !m.voidedAt &&
                    (learner ||
                      studio.currentOrganization?.role === 'owner' ||
                      m.createdBy === studio.user?.id)
                  "
                  variant="ghost"
                  :disabled="busy"
                  @click="openCorrection(m)"
                  >Corregir o anular</UiButton
                >
                <form
                  v-if="correcting?.id === m.id"
                  class="progress-correction"
                  @submit.prevent="perform(correctMeasurement)"
                >
                  <label class="field"
                    >Valor nuevo ({{ m.unit }})<input
                      v-model.number="correctionValue"
                      type="number"
                      inputmode="decimal"
                      min="0.01"
                      :max="measurementKinds[m.kind].max"
                      step="0.01"
                      required
                  /></label>
                  <label class="field"
                    >Fecha<input v-model="correctionDate" type="date" :max="today" required
                  /></label>
                  <label class="field"
                    >Motivo<input v-model="correctionReason" minlength="3" maxlength="200" required
                  /></label>
                  <div class="flow-actions">
                    <UiButton type="submit" :disabled="busy">Guardar corrección</UiButton
                    ><UiButton
                      type="button"
                      variant="secondary"
                      :disabled="busy"
                      @click="perform(voidMeasurement)"
                      >Anular registro</UiButton
                    ><UiButton type="button" variant="ghost" @click="correcting = null"
                      >Volver</UiButton
                    >
                  </div>
                </form>
              </article>
              <UiButton
                v-if="measurementCursor"
                variant="secondary"
                :disabled="busy"
                @click="perform(() => loadMeasurements(true))"
                >Cargar más mediciones</UiButton
              >
            </section></template
          ></template
        >
        <template v-if="tab === 'photos'"
          ><div v-if="!metrics.access.photos" class="ui-card progress-private">
            <Camera :size="30" />
            <h2>Fotos privadas</h2>
            <p>
              {{
                learner
                  ? 'Actívalas desde Privacidad si quieres compartirlas.'
                  : 'El alumno no ha compartido sus fotos contigo.'
              }}
            </p>
            <UiButton v-if="learner" variant="secondary" @click="switchTab('privacy')"
              >Revisar privacidad</UiButton
            >
          </div>
          <template v-else
            ><form
              v-if="learner"
              class="ui-card progress-photo-form"
              @submit.prevent="perform(uploadPhoto)"
            >
              <h2>Añadir foto</h2>
              <p class="muted">PNG/JPEG/WebP, máximo 2 MB y 8 MP. HEIC no admitido.</p>
              <label class="field"
                >Foto de progreso<input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  required
                  @change="pickFile" /></label
              ><label class="field"
                >Fecha de foto<input v-model="photoDate" type="date" :max="today" required /></label
              ><label class="field"
                >Descripción opcional<input v-model="caption" maxlength="200" /></label
              ><UiButton type="submit" :disabled="busy || !file">Guardar foto privada</UiButton>
            </form>
            <div class="progress-photo-grid">
              <article v-for="p in photos" :key="p.id" class="ui-card progress-photo-card">
                <button
                  class="progress-photo-open"
                  :aria-label="`Abrir foto del ${p.measuredOn}`"
                  @click="openPhoto(p)"
                >
                  <img
                    :src="p.thumbnailUrl"
                    :alt="p.caption || 'Foto privada de progreso'"
                    loading="lazy"
                    :width="p.width"
                    :height="p.height"
                  />
                </button>
                <div>
                  <strong>{{ p.measuredOn }}</strong>
                  <p>{{ p.caption || 'Sin descripción' }}</p>
                  <UiButton
                    v-if="learner"
                    variant="ghost"
                    :disabled="busy"
                    @click="perform(() => deletePhoto(p))"
                    >Eliminar foto</UiButton
                  >
                </div>
              </article>
            </div>
            <p v-if="!photos.length" class="ui-card empty-state">Sin fotos compartidas.</p>
            <UiButton
              v-if="photoCursor"
              variant="secondary"
              :disabled="busy"
              @click="perform(() => loadPhotos(true))"
              >Cargar más fotos</UiButton
            ></template
          ></template
        >
        <section v-if="tab === 'privacy' && learner && privacy" class="ui-card progress-privacy">
          <h2>Privacidad del progreso</h2>
          <p>
            El entrenamiento y las mediciones funcionan sin fotos. Tus profesionales solo verán
            mediciones o fotos si les das permiso aquí; puedes retirarlo en cualquier momento.
          </p>
          <form @submit.prevent="perform(savePrivacy)" @change="privacyDirty = true">
            <label class="checkbox-field progress-consent"
              ><input v-model="privacy.photoConsent" type="checkbox" />Quiero usar fotos de progreso
              y acepto su almacenamiento privado.</label
            >
            <p class="small-text muted">
              Al retirarlo se eliminarán las fotos activas de la aplicación. Los archivos se depuran
              a los 30 días y las copias anteriores siguen su retención operativa. No se pueden
              retirar imágenes ya descargadas por un destinatario autorizado.
            </p>
            <article v-for="p in privacy.professionals" :key="p.id" class="progress-sharing-row">
              <strong
                >{{ p.name }}
                <small>{{
                  p.role === 'owner' ? 'Responsable del estudio' : 'Profesional asignado'
                }}</small></strong
              ><label class="checkbox-field"
                ><input
                  v-model="p.measurements"
                  type="checkbox"
                  :aria-label="`Compartir mediciones con ${p.name}`"
                />Mediciones</label
              ><label class="checkbox-field"
                ><input
                  v-model="p.photos"
                  type="checkbox"
                  :disabled="!privacy.photoConsent"
                  :aria-label="`Compartir fotos con ${p.name}`"
                />Fotos</label
              >
            </article>
            <UiButton type="submit" :disabled="busy">Guardar privacidad</UiButton>
            <p v-if="privacyDirty" role="status" class="small-text">Permisos sin guardar.</p>
          </form>
        </section>
      </template>
    </template>
  </section>
  <PageStep
    v-if="selectedPhoto"
    title="Foto de progreso"
    back-label="Progreso"
    @back="selectedPhoto = null"
  >
    <figure class="progress-photo-page">
      <img :src="selectedPhoto.url" :alt="selectedPhoto.caption || 'Foto privada de progreso'" />
      <figcaption>{{ selectedPhoto.measuredOn }} · {{ selectedPhoto.caption }}</figcaption>
    </figure>
  </PageStep>
</template>
