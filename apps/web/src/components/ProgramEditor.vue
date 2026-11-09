<script setup lang="ts">
import { confirmAction } from '../action-review';
import { useContextGuard } from '../action-review';
import { ref, computed, onMounted, onBeforeUnmount, watch, toRaw } from 'vue';
import { useRoute, useRouter, onBeforeRouteUpdate, onBeforeRouteLeave } from 'vue-router';
import {
  ArrowLeft,
  Plus,
  Copy,
  ChevronUp,
  ChevronDown,
  Trash2,
  Save,
  Send,
  Eye,
  Check,
  Search,
} from '@lucide/vue';
import { UiButton } from '@forma/ui';
import {
  validateProgram,
  freshSet,
  cloneWeek,
  cloneDay,
  type ProgramDocument,
  type TrainingProgram,
  type LibraryExercise,
  type ProgramEntry,
  type ProgramVersion,
  type MediaAsset,
  type StudioEquipment,
} from '@forma/shared';
import { apiRequest } from '../api';
import { useStudio } from '../stores/studio';
import ProgramReader from './ProgramReader.vue';
import PageStep from './PageStep.vue';
import LibraryEditor from './LibraryEditor.vue';
import { useRoutePanel } from '../route-panel';
const props = defineProps<{
  organizationId: string;
  program: TrainingProgram | null;
}>();
const emit = defineEmits<{
  close: [];
  saved: [TrainingProgram];
  published: [ProgramVersion];
}>();
const studio = useStudio(),
  root = `/v1/organizations/${props.organizationId}`;
const record = ref(props.program);
const document = ref<ProgramDocument>(
  props.program
    ? structuredClone(toRaw(props.program.document))
    : {
        name: '',
        description: '',
        isTemplate: false,
        weeks: [
          {
            id: crypto.randomUUID(),
            name: 'Semana 1',
            days: [
              {
                id: crypto.randomUUID(),
                name: 'Día 1',
                weekday: 1,
                notes: '',
                exercises: [],
              },
            ],
          },
        ],
      },
);
let savedJson = JSON.stringify(document.value);
let contextDiscardApproved = false;
const changed = ref(!props.program);
watch(
  document,
  () => {
    changed.value = JSON.stringify(document.value) !== savedJson;
    contextDiscardApproved = false;
  },
  { deep: true },
);
const busy = ref(false),
  error = ref(''),
  weekIndex = ref(0),
  dayIndex = ref(0),
  entryIndex = ref(0);
const route = useRoute(),
  router = useRouter();
const stage = computed({
  get: () =>
    ['structure', 'exercises', 'review'].includes(String(route.query.step))
      ? String(route.query.step)
      : 'structure',
  set: (value) => {
    void router.push({ query: { ...route.query, step: value } });
  },
});
const library = ref<LibraryExercise[]>([]),
  known = ref<Record<string, LibraryExercise>>({}),
  query = ref(''),
  libraryCursor = ref<string | null>(null),
  loadingLibrary = ref(false),
  picker = ref(false),
  preview = ref<ProgramDocument | null>(null);
const week = computed(() => document.value.weeks[weekIndex.value]);
const day = computed(() => week.value?.days[dayIndex.value]);
const entry = computed(() => day.value?.exercises[entryIndex.value]);
const exercise = computed(() => (entry.value ? known.value[entry.value.exerciseId] : null));
const totalDays = computed(() => document.value.weeks.reduce((n, w) => n + w.days.length, 0));
let disposed = false,
  searchEpoch = 0;
let timer: ReturnType<typeof setTimeout>;
async function search(more = false) {
  const epoch = ++searchEpoch;
  loadingLibrary.value = true;
  try {
    const data = await apiRequest<{
      exercises: LibraryExercise[];
      nextCursor: string | null;
    }>(
      root +
        `/exercises?q=${encodeURIComponent(query.value)}&state=all&origin=all&limit=30${more && libraryCursor.value ? `&cursor=${libraryCursor.value}` : ''}`,
    );
    if (disposed || epoch !== searchEpoch) return;
    library.value = (more ? [...library.value, ...data.exercises] : data.exercises).filter(
      (x) => x.state !== 'archived',
    );
    libraryCursor.value = data.nextCursor;
    for (const x of data.exercises) known.value[x.id] = x;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos buscar ejercicios.';
  } finally {
    if (epoch === searchEpoch) loadingLibrary.value = false;
  }
}
watch(query, () => {
  clearTimeout(timer);
  timer = setTimeout(() => search(), 300);
});
watch(
  () => entry.value?.exerciseId,
  async (id) => {
    if (!id || known.value[id]) return;
    try {
      const result = await apiRequest<{
        exercise: LibraryExercise;
      }>(root + '/exercises/' + id);
      if (!disposed) known.value[id] = result.exercise;
    } catch {
      if (!disposed)
        error.value = 'Un ejercicio ya no está disponible. Sustitúyelo antes de publicar.';
    }
  },
  { immediate: true },
);
function beforeUnload(event: BeforeUnloadEvent) {
  if (changed.value) {
    event.preventDefault();
    event.returnValue = '';
  }
}
async function canLeave() {
  return (
    contextDiscardApproved ||
    !changed.value ||
    (await confirmAction('Tienes cambios sin guardar. ¿Quieres salir y descartarlos?'))
  );
}
onBeforeRouteLeave(async () => contextDiscardApproved || (await canLeave()));
onBeforeRouteUpdate(async (to, from) =>
  to.query.edit !== from.query.edit ? await canLeave() : true,
);
useRoutePanel(
  'preview',
  preview,
  () => 'student',
  async () => {
    return (
      await apiRequest<{
        snapshot: ProgramDocument;
      }>(root + '/programs/preview', {
        method: 'POST',
        body: { document: document.value },
      })
    ).snapshot;
  },
);
onMounted(() => {
  search();
  window.addEventListener('beforeunload', beforeUnload);
});
onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(timer);
  window.removeEventListener('beforeunload', beforeUnload);
});
async function close() {
  if (await canLeave()) {
    contextDiscardApproved = true;
    emit('close');
  }
}
function addWeek(copy = false) {
  if (document.value.weeks.length >= 16) return;
  const w =
    copy && week.value
      ? cloneWeek(toRaw(week.value))
      : { id: crypto.randomUUID(), name: `Semana ${document.value.weeks.length + 1}`, days: [] };
  w.name = `Semana ${document.value.weeks.length + 1}`;
  document.value.weeks.push(w);
  weekIndex.value = document.value.weeks.length - 1;
  dayIndex.value = 0;
  entryIndex.value = 0;
}
function removeWeek() {
  if (document.value.weeks.length === 1) return;
  document.value.weeks.splice(weekIndex.value, 1);
  weekIndex.value = Math.max(0, weekIndex.value - 1);
  dayIndex.value = 0;
}
function addDay(copy = false) {
  if (!week.value || week.value.days.length >= 7) return;
  const available = [1, 2, 3, 4, 5, 6, 7].find(
    (n) => !week.value!.days.some((d) => d.weekday === n),
  )!;
  const d =
    copy && day.value
      ? cloneDay(toRaw(day.value))
      : {
          id: crypto.randomUUID(),
          name: `Día ${available}`,
          weekday: available,
          notes: '',
          exercises: [],
        };
  d.weekday = available;
  week.value.days.push(d);
  dayIndex.value = week.value.days.length - 1;
  entryIndex.value = 0;
}
function removeDay() {
  week.value?.days.splice(dayIndex.value, 1);
  dayIndex.value = 0;
  entryIndex.value = 0;
}
function move<T>(array: T[], index: number, delta: number) {
  const next = index + delta;
  if (next < 0 || next >= array.length) return;
  [array[index], array[next]] = [array[next]!, array[index]!];
}
function addExercise(x: LibraryExercise) {
  if (!day.value || day.value.exercises.length >= 20) return;
  known.value[x.id] = x;
  day.value.exercises.push({
    id: crypto.randomUUID(),
    exerciseId: x.id,
    notes: '',
    sets: [blankSet(x.metric)],
  });
  entryIndex.value = day.value.exercises.length - 1;
  picker.value = false;
  if (stage.value !== 'exercises') stage.value = 'exercises';
}
function moveEntry(delta: number) {
  if (day.value) {
    move(day.value.exercises, entryIndex.value, delta);
    entryIndex.value = Math.max(
      0,
      Math.min(day.value.exercises.length - 1, entryIndex.value + delta),
    );
  }
}
function removeEntry() {
  day.value?.exercises.splice(entryIndex.value, 1);
  entryIndex.value = 0;
}
function blankSet(metric: 'reps' | 'time' | 'distance' = 'reps') {
  return {
    ...freshSet(metric),
    repsMin: null,
    repsMax: null,
    weightKg: null,
    seconds: null,
    distanceMeters: null,
    rpe: null,
    restSeconds: 0,
  };
}
async function persist() {
  const issues = validateProgram(document.value);
  if (issues.length) throw new Error(issues.join(' '));
  if (!changed.value && record.value) return record.value;
  const response = await apiRequest<{
    program: TrainingProgram;
  }>(root + '/programs' + (record.value ? '/' + record.value.id : ''), {
    method: record.value ? 'PUT' : 'POST',
    body: {
      document: document.value,
      ...(record.value ? { revision: record.value.revision } : {}),
    },
  });
  record.value = response.program;
  savedJson = JSON.stringify(document.value);
  changed.value = false;
  emit('saved', response.program);
  return response.program;
}
async function save(publish = false) {
  busy.value = true;
  error.value = '';
  try {
    if (publish) {
      const issues = validateProgram(document.value, true);
      if (issues.length) throw new Error(issues.join(' '));
    }
    const p = await persist();
    if (publish) {
      const response = await apiRequest<{
        version: ProgramVersion;
      }>(root + `/programs/${p.id}/publish`, { method: 'POST', body: { revision: p.revision } });
      emit('published', response.version);
      studio.notify(
        `Versión ${response.version.number} publicada. Las asignaciones anteriores conservan su versión.`,
      );
    } else studio.notify('Borrador guardado.');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos guardar el programa.';
  } finally {
    busy.value = false;
  }
}
async function openPreview() {
  busy.value = true;
  error.value = '';
  try {
    preview.value = (
      await apiRequest<{
        snapshot: ProgramDocument;
      }>(root + '/programs/preview', {
        method: 'POST',
        body: { document: document.value },
      })
    ).snapshot;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos preparar la vista previa.';
  } finally {
    busy.value = false;
  }
}
function setCount(x: ProgramEntry) {
  return `${x.sets.length} series`;
}
const creatingExercise = ref<{ open: true } | null>(null);
const pickerMedia = ref<MediaAsset[]>([]),
  pickerEquipment = ref<StudioEquipment[]>([]);
useRoutePanel(
  'createExercise',
  creatingExercise,
  () => 'new',
  () => ({ open: true }),
);
async function createExercise() {
  try {
    const [m, q] = await Promise.all([
      apiRequest<{ media: MediaAsset[] }>(root + '/media'),
      apiRequest<{ equipment: StudioEquipment[] }>(root + '/equipment'),
    ]);
    pickerMedia.value = m.media;
    pickerEquipment.value = q.equipment;
    creatingExercise.value = { open: true };
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos abrir el ejercicio.';
  }
}
function createdExercise(value?: LibraryExercise) {
  creatingExercise.value = null;
  if (value) {
    library.value.unshift(value);
    addExercise(value);
  }
}
useContextGuard(canLeave);
</script>
<template>
  <div class="program-editor">
    <div v-show="!preview && !creatingExercise">
      <button class="text-button program-back" @click="close">
        <ArrowLeft :size="17" />Volver a programas
      </button>
      <div class="page-heading">
        <div>
          <h1>{{ record ? 'Editar rutina' : 'Nueva rutina' }}</h1>
        </div>
        <span v-if="changed" class="status-badge" role="status">Cambios sin guardar</span>
      </div>
      <div class="program-mobile-steps" aria-label="Pasos del constructor">
        <button
          v-for="(s, i) in ['structure', 'exercises', 'review']"
          :key="s"
          :class="{ active: stage === s }"
          @click="stage = s"
        >
          {{ i + 1 }}. {{ ['Estructura', 'Ejercicios', 'Revisar'][i] }}
        </button>
      </div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="program-builder-grid">
        <section
          class="builder-stage program-structure"
          :class="{ 'is-visible': stage === 'structure' }"
        >
          <div class="program-section-title">
            <span class="eyebrow">01 · TU PROGRAMA</span
            ><span>{{ document.weeks.length }} semanas</span>
          </div>
          <label class="field"
            >Nombre del programa<input
              v-model="document.name"
              maxlength="100"
              autocomplete="off" /></label
          ><label class="field"
            >Objetivo y descripción<textarea
              v-model="document.description"
              maxlength="1500"
              rows="3"
            /></label
          ><label class="program-checkbox"
            ><input v-model="document.isTemplate" type="checkbox" />Guardar como plantilla
            reutilizable</label
          >
          <div class="program-section-title">
            <h2>Semanas</h2>
            <button
              class="icon-button"
              :disabled="document.weeks.length >= 16"
              aria-label="Añadir semana"
              @click="addWeek()"
            >
              <Plus :size="19" />
            </button>
          </div>
          <ol class="program-outline">
            <li v-for="(w, i) in document.weeks" :key="w.id">
              <button
                :class="{ active: i === weekIndex }"
                :aria-label="`Editar semana ${i + 1}`"
                @click="
                  weekIndex = i;
                  dayIndex = 0;
                  entryIndex = 0;
                "
              >
                <span>{{ String(i + 1).padStart(2, '0') }}</span
                ><strong>{{ w.name }}</strong
                ><small>{{ w.days.length }} días</small>
              </button>
            </li>
          </ol>
          <div v-if="week" class="program-week-tools">
            <UiButton
              variant="secondary"
              :disabled="document.weeks.length >= 16"
              @click="addWeek(true)"
              ><Copy :size="15" />Duplicar semana</UiButton
            ><button
              class="icon-button"
              aria-label="Subir semana"
              :disabled="weekIndex === 0"
              @click="
                move(document.weeks, weekIndex, -1);
                weekIndex--;
              "
            >
              <ChevronUp :size="18" /></button
            ><button
              class="icon-button"
              aria-label="Bajar semana"
              :disabled="weekIndex === document.weeks.length - 1"
              @click="
                move(document.weeks, weekIndex, 1);
                weekIndex++;
              "
            >
              <ChevronDown :size="18" /></button
            ><button
              class="icon-button"
              aria-label="Eliminar semana"
              :disabled="document.weeks.length === 1"
              @click="removeWeek"
            >
              <Trash2 :size="17" />
            </button>
          </div>
          <UiButton class="program-mobile-next" @click="stage = 'exercises'"
            >Continuar con los días <ChevronDown :size="16"
          /></UiButton>
        </section>
        <section
          class="builder-stage program-day-editor"
          :class="{ 'is-visible': stage === 'exercises' }"
        >
          <div class="program-section-title">
            <span class="eyebrow">02 · SEMANA {{ weekIndex + 1 }}</span
            ><span>{{ day?.exercises.length ?? 0 }} ejercicios</span>
          </div>
          <label v-if="week" class="field"
            >Nombre de la semana<input v-model="week.name" maxlength="80"
          /></label>
          <nav class="program-day-tabs" aria-label="Editar días">
            <button
              v-for="(d, i) in week?.days"
              :key="d.id"
              :class="{ active: i === dayIndex }"
              @click="
                dayIndex = i;
                entryIndex = 0;
              "
            >
              <span>Día {{ d.weekday }}</span
              ><strong>{{ d.name }}</strong></button
            ><button
              :disabled="(week?.days.length ?? 0) >= 7"
              aria-label="Añadir día"
              @click="addDay()"
            >
              <Plus :size="19" /><span>Añadir día</span>
            </button>
          </nav>
          <template v-if="day"
            ><div class="program-day-settings">
              <label class="field">Nombre del día<input v-model="day.name" maxlength="80" /></label
              ><label class="field"
                >Día del ciclo<select v-model.number="day.weekday">
                  <option
                    v-for="n in 7"
                    :key="n"
                    :value="n"
                    :disabled="week?.days.some((d) => d.id !== day!.id && d.weekday === n)"
                  >
                    Día {{ n }} desde el inicio
                  </option>
                </select></label
              >
            </div>
            <label class="field"
              >Indicaciones del día<textarea v-model="day.notes" maxlength="1000" rows="2" />
            </label>
            <div class="program-week-tools">
              <UiButton
                variant="secondary"
                :disabled="(week?.days.length ?? 0) >= 7"
                @click="addDay(true)"
                ><Copy :size="15" />Duplicar día</UiButton
              ><button
                class="icon-button"
                aria-label="Subir día"
                :disabled="dayIndex === 0"
                @click="
                  move(week!.days, dayIndex, -1);
                  dayIndex--;
                "
              >
                <ChevronUp :size="18" /></button
              ><button
                class="icon-button"
                aria-label="Bajar día"
                :disabled="dayIndex === (week?.days.length ?? 0) - 1"
                @click="
                  move(week!.days, dayIndex, 1);
                  dayIndex++;
                "
              >
                <ChevronDown :size="18" /></button
              ><button class="icon-button" aria-label="Eliminar día" @click="removeDay">
                <Trash2 :size="17" />
              </button>
            </div>
            <div class="program-section-title">
              <h2>Ejercicios del día</h2>
              <span>{{ day.exercises.length }} / 20</span>
            </div>
            <ol class="program-entry-list">
              <li v-for="(x, i) in day.exercises" :key="x.id">
                <button
                  :class="{ active: i === entryIndex }"
                  :aria-label="`Editar ejercicio ${i + 1}`"
                  @click="entryIndex = i"
                >
                  <span class="program-order">{{ i + 1 }}</span>
                  <div>
                    <strong>{{ known[x.exerciseId]?.name ?? 'Ejercicio guardado' }}</strong
                    ><small>{{ setCount(x) }}</small>
                  </div>
                  <Check v-if="i === entryIndex" :size="16" />
                </button>
              </li>
            </ol>
            <UiButton
              variant="secondary"
              :disabled="day.exercises.length >= 20"
              @click="picker = !picker"
              ><Plus :size="17" />Añadir ejercicio</UiButton
            >
            <div v-if="picker" class="program-picker">
              <UiButton variant="secondary" @click="createExercise"
                >Crear ejercicio y añadirlo</UiButton
              >
              <label class="search-field"
                ><Search :size="17" /><input
                  v-model="query"
                  type="search"
                  aria-label="Buscar ejercicio para rutina"
                  placeholder="Busca en tu biblioteca…"
              /></label>
              <p v-if="loadingLibrary" role="status">Buscando…</p>
              <button
                v-for="x in library"
                :key="x.id"
                class="program-picker-item"
                :aria-label="`Añadir ${x.name}`"
                @click="addExercise(x)"
              >
                <div>
                  <strong>{{ x.name }}</strong
                  ><small
                    >{{ x.muscle }} ·
                    {{
                      x.metric === 'reps'
                        ? 'Repeticiones'
                        : x.metric === 'time'
                          ? 'Tiempo'
                          : 'Distancia'
                    }}</small
                  >
                </div>
                <Plus :size="18" /></button
              ><UiButton v-if="libraryCursor" variant="secondary" @click="search(true)"
                >Cargar más ejercicios</UiButton
              >
              <p v-if="!loadingLibrary && !library.length">
                Todavía no hay ejercicios con ese nombre.
              </p>
            </div>
            <section v-if="entry" class="program-set-editor">
              <div class="program-section-title">
                <h3>{{ exercise?.name ?? 'Prescripciones' }}</h3>
                <div class="program-week-tools">
                  <button
                    class="icon-button"
                    aria-label="Subir ejercicio"
                    :disabled="entryIndex === 0"
                    @click="moveEntry(-1)"
                  >
                    <ChevronUp :size="17" /></button
                  ><button
                    class="icon-button"
                    aria-label="Bajar ejercicio"
                    :disabled="entryIndex === day.exercises.length - 1"
                    @click="moveEntry(1)"
                  >
                    <ChevronDown :size="17" /></button
                  ><button class="icon-button" aria-label="Eliminar ejercicio" @click="removeEntry">
                    <Trash2 :size="17" />
                  </button>
                </div>
              </div>
              <p class="muted small-text">{{ exercise?.instructions }}</p>
              <label class="field"
                >Nota para este ejercicio<textarea
                  v-model="entry.notes"
                  maxlength="1000"
                  rows="2"
                />
              </label>
              <fieldset v-for="(s, i) in entry.sets" :key="s.id" class="program-set-fields">
                <legend>Serie {{ i + 1 }}</legend>
                <template v-if="!exercise || exercise.metric === 'reps'"
                  ><label class="field"
                    >Repeticiones mín.<input
                      v-model.number="s.repsMin"
                      :aria-label="`Serie ${i + 1} repeticiones mínimas`"
                      type="number"
                      min="1"
                      max="999"
                      inputmode="numeric" /></label
                  ><label class="field"
                    >Repeticiones máx.<input
                      v-model.number="s.repsMax"
                      :aria-label="`Serie ${i + 1} repeticiones máximas`"
                      type="number"
                      min="1"
                      max="999"
                      inputmode="numeric" /></label></template
                ><label v-else-if="exercise.metric === 'time'" class="field"
                  >Tiempo (s)<input
                    v-model.number="s.seconds"
                    :aria-label="`Serie ${i + 1} segundos`"
                    type="number"
                    min="1"
                    max="86400"
                    inputmode="numeric" /></label
                ><label v-else class="field"
                  >Distancia (m)<input
                    v-model.number="s.distanceMeters"
                    :aria-label="`Serie ${i + 1} distancia`"
                    type="number"
                    min="1"
                    max="100000"
                    inputmode="decimal" /></label
                ><label class="field"
                  >Carga (kg, opcional)<input
                    :value="s.weightKg ?? ''"
                    :aria-label="`Serie ${i + 1} carga`"
                    type="number"
                    min="0"
                    max="1000"
                    step="0.25"
                    inputmode="decimal"
                    @input="
                      s.weightKg =
                        ($event.target as HTMLInputElement).value === ''
                          ? null
                          : Number(($event.target as HTMLInputElement).value)
                    " /></label
                ><label class="field"
                  >Descanso (s)<input
                    v-model.number="s.restSeconds"
                    :aria-label="`Serie ${i + 1} descanso`"
                    type="number"
                    min="0"
                    max="1800"
                    inputmode="numeric" /></label
                ><label class="field"
                  >Esfuerzo 1–10<input
                    :value="s.rpe ?? ''"
                    :aria-label="`Serie ${i + 1} esfuerzo`"
                    type="number"
                    min="1"
                    max="10"
                    step="0.5"
                    inputmode="decimal"
                    @input="
                      s.rpe =
                        ($event.target as HTMLInputElement).value === ''
                          ? null
                          : Number(($event.target as HTMLInputElement).value)
                    " /></label
                ><button
                  class="icon-button"
                  :aria-label="`Eliminar serie ${i + 1}`"
                  :disabled="entry.sets.length === 1"
                  @click="entry.sets.splice(i, 1)"
                >
                  <Trash2 :size="17" />
                </button>
              </fieldset>
              <UiButton
                variant="secondary"
                :disabled="entry.sets.length >= 12"
                @click="entry.sets.push(blankSet(exercise?.metric))"
                ><Plus :size="16" />Añadir serie</UiButton
              >
            </section>
          </template>
          <div v-else class="empty-state">
            <h2>Sin días</h2>
            <p>Añade su primer día de entrenamiento para continuar.</p>
            <UiButton @click="addDay()"><Plus :size="16" />Añadir primer día</UiButton>
          </div>
        </section>
        <aside class="builder-stage program-review" :class="{ 'is-visible': stage === 'review' }">
          <span class="eyebrow">03 · ANTES DE COMPARTIR</span>
          <h2>Revisar rutina</h2>
          <div class="program-review-stats">
            <strong>{{ document.weeks.length }}<small>semanas</small></strong
            ><strong>{{ totalDays }}<small>días</small></strong>
          </div>
          <p class="muted">
            Publicar guarda una versión fija de ejercicios, instrucciones, equipo y series. Después
            podrás asignarla a tus alumnos.
          </p>
          <p class="program-notice">
            Los programas asignados conservan su versión aunque sigas editando este borrador.
          </p>
          <UiButton variant="secondary" :disabled="busy" @click="openPreview"
            ><Eye :size="17" />Vista previa alumno</UiButton
          >
          <p class="small-text muted">
            Cada semana tiene siete días desde la fecha de inicio de la asignación. Los días sin
            entrenamiento son descanso.
          </p>
        </aside>
      </div>
      <div class="editor-step-actions">
        <UiButton
          v-if="stage !== 'structure'"
          variant="secondary"
          @click="stage = stage === 'review' ? 'exercises' : 'structure'"
          >Anterior</UiButton
        >
        <UiButton
          v-if="stage !== 'review'"
          @click="stage = stage === 'structure' ? 'exercises' : 'review'"
          >Continuar</UiButton
        >
      </div>
      <footer class="program-editor-actions">
        <span>{{ changed ? 'Tienes cambios pendientes' : 'Todo guardado' }}</span
        ><UiButton variant="secondary" :disabled="busy" @click="save()"
          ><Save :size="17" />Guardar borrador</UiButton
        ><UiButton :disabled="busy" @click="save(true)"
          ><Send :size="17" />Publicar versión</UiButton
        >
      </footer>
    </div>
    <LibraryEditor
      v-if="creatingExercise"
      :organization-id="organizationId"
      kind="exercise"
      :media="pickerMedia"
      :equipment-options="pickerEquipment"
      @close="creatingExercise = null"
      @saved="createdExercise"
      @uploaded="pickerMedia.unshift($event)"
    />
    <PageStep v-if="preview" back-label="Editor" @back="preview = null">
      <ProgramReader :document="preview" :organization-id="organizationId" preview />
    </PageStep>
  </div>
</template>
