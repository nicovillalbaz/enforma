<script setup lang="ts">
import { confirmAction } from '../action-review';
import { ref, watch, onMounted, computed } from 'vue';
import type {
  FollowupThread,
  FollowupTracking as Tracking,
  CheckinDocument,
  CheckinTemplate,
  CheckinField,
  HabitKind,
} from '@forma/shared';
import { apiRequest } from '../api';
import { billingDate } from '../billing-date';
import FollowupHabit from './FollowupHabit.vue';
import FollowupCheckin from './FollowupCheckin.vue';
const props = defineProps<{
    root: string;
    thread: FollowupThread;
    learner: boolean;
    refresh: number;
    pdfEnabled: boolean;
  }>(),
  emit = defineEmits<{
    dirty: [value: boolean];
  }>(),
  data = ref<Tracking>(),
  busy = ref(false),
  error = ref(''),
  notice = ref('');
const today = billingDate(new Date().toISOString()),
  end = new Date(Date.parse(today + 'T12:00:00Z') + 27 * 86400000).toISOString().slice(0, 10),
  startsOn = ref(today),
  endsOn = ref(end),
  habitName = ref(''),
  habitKind = ref<HabitKind>('check'),
  habitTarget = ref<string | number>(''),
  instructions = ref(''),
  weekdays = ref([1, 2, 3, 4, 5, 6, 7]),
  habitId = ref<string>(crypto.randomUUID()),
  templateId = ref<string>(crypto.randomUUID()),
  templateRevision = ref(0),
  editing = ref(false),
  template = ref<CheckinDocument>({ name: '', description: '', fields: [] }),
  versionId = ref(''),
  frequency = ref('weekly'),
  weekday = ref(new Date(today + 'T12:00:00Z').getUTCDay() || 7),
  monthDay = ref(Number(today.slice(-2))),
  windowDays = ref(7),
  scheduleId = ref<string>(crypto.randomUUID());
const dirtyKeys = new Set<string>(),
  templateDirty = ref(false);
function dirty(key: string, value: boolean) {
  if (value) dirtyKeys.add(key);
  else dirtyKeys.delete(key);
  emit('dirty', dirtyKeys.size > 0 || templateDirty.value);
}
function mark() {
  templateDirty.value = true;
  emit('dirty', true);
}
let loading = 0;
async function load() {
  const ticket = ++loading;
  try {
    const value = await apiRequest<Tracking>(
      props.root + '/threads/' + props.thread.id + '/tracking',
    );
    if (ticket === loading) data.value = value;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar seguimiento.';
  }
}
async function act(fn: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await fn();
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar.';
  } finally {
    busy.value = false;
  }
}
async function assign() {
  await act(async () => {
    await apiRequest(props.root + '/threads/' + props.thread.id + '/habits', {
      method: 'POST',
      body: {
        id: habitId.value,
        document: {
          name: habitName.value,
          kind: habitKind.value,
          target:
            habitKind.value === 'check'
              ? 1
              : habitTarget.value === ''
                ? null
                : Number(habitTarget.value),
          weekdays: weekdays.value,
          instructions: instructions.value,
        },
        startsOn: startsOn.value,
        endsOn: endsOn.value,
      },
    });
    habitId.value = crypto.randomUUID();
    habitName.value = '';
    habitTarget.value = '';
    instructions.value = '';
    dirty('habit', false);
    notice.value = 'Hábito asignado.';
  });
}
async function edit(t?: CheckinTemplate) {
  if (templateDirty.value && !(await confirmAction('¿Descartar cambios de plantilla?'))) return;
  template.value = t
    ? (JSON.parse(JSON.stringify(t.document)) as CheckinDocument)
    : { name: '', description: '', fields: [] };
  templateId.value = t?.id ?? crypto.randomUUID();
  templateRevision.value = t?.revision ?? 0;
  templateDirty.value = false;
  editing.value = true;
  versionId.value = '';
  emit('dirty', dirtyKeys.size > 0);
}
function addField() {
  if (template.value.fields.length >= 12) return;
  template.value.fields.push({
    id: crypto.randomUUID(),
    label: '',
    type: 'text',
    required: false,
    min: null,
    max: null,
    options: [],
    unit: '',
  });
  mark();
}
function minmax(f: CheckinField, key: 'min' | 'max', e: Event) {
  const v = (e.target as HTMLInputElement).value;
  f[key] = v === '' ? null : Number(v);
  mark();
}
async function saveTemplate() {
  await act(async () => {
    await apiRequest(props.root + '/templates/' + templateId.value, {
      method: 'PUT',
      body: { revision: templateRevision.value, document: template.value },
    });
    templateRevision.value++;
    templateDirty.value = false;
    emit('dirty', dirtyKeys.size > 0);
    versionId.value = '';
    notice.value = 'Borrador guardado.';
  });
}
async function publish() {
  await act(async () => {
    versionId.value = (
      await apiRequest<{
        id: string;
      }>(props.root + '/templates/' + templateId.value + '/publish', {
        method: 'POST',
        body: { revision: templateRevision.value },
      })
    ).id;
    notice.value = 'Versión publicada. Puedes programarla para esta conversación.';
  });
}
async function schedule() {
  await act(async () => {
    await apiRequest(props.root + '/threads/' + props.thread.id + '/schedules', {
      method: 'POST',
      body: {
        id: scheduleId.value,
        versionId: versionId.value,
        frequency: frequency.value,
        weekday: weekday.value,
        monthDay: monthDay.value,
        windowDays: windowDays.value,
        startsOn: startsOn.value,
        endsOn: endsOn.value,
      },
    });
    scheduleId.value = crypto.randomUUID();
    dirty('schedule', false);
    notice.value = 'Check-ins programados.';
  });
}
const hasEntries = computed(() => !!data.value?.trackingAllowed),
  canRecord = computed(() => !!data.value?.recordingAllowed),
  visibleTasks = computed(() => {
    const priority = (task: NonNullable<Tracking['tasks']>[number]) =>
      task.scheduledOn > today
        ? 3
        : task.response
          ? 1
          : task.cancelled || task.closesOn < today
            ? 2
            : 0;
    return [...(data.value?.tasks ?? [])].sort(
      (a, b) =>
        priority(a) - priority(b) ||
        (priority(a) === 3
          ? a.scheduledOn.localeCompare(b.scheduledOn)
          : b.scheduledOn.localeCompare(a.scheduledOn)),
    );
  });
watch(
  () => props.refresh,
  () => void load(),
);
onMounted(() => void load());
</script>
<template>
  <section class="followup-pad followup-stack">
    <header>
      <h3>Pequeños pasos, a tu ritmo</h3>
      <p class="muted">
        Agua, sueño y energía son registros opcionales. Los días sin datos se muestran como sin
        registro.
      </p>
    </header>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <p v-if="notice" class="success-message" role="status">{{ notice }}</p>
    <p v-if="data && (learner ? !canRecord : !hasEntries)" class="followup-privacy-note">
      {{
        learner
          ? 'Activa el permiso en Privacidad para registrar hábitos y responder check-ins. Puedes omitir un check-in sin autorizar el seguimiento.'
          : 'El alumno todavía no ha autorizado el seguimiento para esta conversación.'
      }}
    </p>
    <p v-if="data?.truncated" class="muted">
      Se muestran los hábitos recientes y hasta 100 check-ins del periodo. Divide asignaciones
      largas para revisar con claridad.
    </p>
    <details v-if="!learner && thread.canWrite" class="followup-editor">
      <summary>Asignar un hábito</summary>
      <form class="followup-stack" @submit.prevent="assign" @input="dirty('habit', true)">
        <label class="field"
          >Nombre<input v-model="habitName" minlength="2" maxlength="100" required /></label
        ><label class="field"
          >Tipo<select v-model="habitKind">
            <option value="check">Hecho / no realizado</option>
            <option value="water">Agua · litros</option>
            <option value="sleep">Sueño · horas</option>
            <option value="energy">Energía · escala de 1 a 5</option>
          </select></label
        ><label v-if="habitKind !== 'check'" class="field"
          >Referencia opcional<input
            v-model="habitTarget"
            type="number"
            :min="habitKind === 'energy' ? 1 : 0"
            :max="habitKind === 'water' ? 20 : habitKind === 'sleep' ? 24 : 5"
            :step="habitKind === 'energy' ? 1 : 0.1"
            placeholder="Sin objetivo numérico"
        /></label>
        <fieldset>
          <legend>Días de registro</legend>
          <div class="followup-inline">
            <label v-for="(d, i) in ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']" :key="d"
              ><input v-model="weekdays" type="checkbox" :value="i + 1" />{{ d }}</label
            >
          </div>
        </fieldset>
        <div class="followup-form-grid">
          <label class="field">Desde<input v-model="startsOn" type="date" required /></label
          ><label class="field"
            >Hasta<input v-model="endsOn" type="date" :min="startsOn" required
          /></label>
        </div>
        <label class="field"
          >Instrucciones opcionales<textarea
            v-model="instructions"
            maxlength="1000"
            rows="2"
          ></textarea></label
        ><button class="button button-primary" :disabled="busy || !weekdays.length">
          Asignar hábito
        </button>
      </form>
    </details>
    <FollowupHabit
      v-for="h in data?.habits"
      :key="h.id"
      :root="root"
      :habit="h"
      :entries="data?.entries ?? []"
      :learner="learner"
      :allowed="hasEntries"
      :can-write="thread.canWrite && (!learner || canRecord)"
      @dirty="dirty(h.id, $event)"
      @saved="load"
    />
    <p v-if="!data?.habits.length" class="muted">Todavía no hay hábitos asignados.</p>
    <details v-if="!learner && thread.canWrite" class="followup-editor">
      <summary>Plantillas y programación de check-ins</summary>
      <div class="followup-stack">
        <button
          type="button"
          class="button button-ghost"
          @click="
            async () => {
              await edit();
            }
          "
        >
          Nueva plantilla</button
        ><label class="field"
          >Editar un borrador<select
            :value="''"
            @change="
              async ($event: Event) => {
                await edit(
                  data?.templates.find((t) => t.id === ($event.target as HTMLSelectElement).value),
                );
              }
            "
          >
            <option value="">Seleccionar plantilla</option>
            <option v-for="t in data?.templates" :key="t.id" :value="t.id">
              {{ t.document.name }}
            </option>
          </select></label
        >
        <form v-if="editing" class="followup-stack" @submit.prevent="saveTemplate" @input="mark">
          <label class="field"
            >Nombre de plantilla<input
              v-model="template.name"
              minlength="2"
              maxlength="100"
              required /></label
          ><label class="field"
            >Descripción<textarea
              v-model="template.description"
              maxlength="2000"
              rows="2"
            ></textarea>
          </label>
          <fieldset v-for="(f, i) in template.fields" :key="f.id" class="followup-template-field">
            <legend>Campo {{ i + 1 }}</legend>
            <label class="field">Pregunta<input v-model="f.label" maxlength="150" required /></label
            ><label class="field"
              >Tipo<select v-model="f.type">
                <option value="text">Texto</option>
                <option value="number">Número</option>
                <option value="scale">Escala entera</option>
                <option value="choice">Opción</option>
                <option value="boolean">Sí / no</option>
                <option value="attachment">Adjunto privado</option>
              </select></label
            ><label class="followup-check"
              ><input v-model="f.required" type="checkbox" />Obligatorio</label
            ><template v-if="f.type === 'number' || f.type === 'scale'"
              ><div class="followup-form-grid">
                <label class="field"
                  >Mínimo<input
                    type="number"
                    :value="f.min ?? ''"
                    :required="f.type === 'scale'"
                    @input="minmax(f, 'min', $event)" /></label
                ><label class="field"
                  >Máximo<input
                    type="number"
                    :value="f.max ?? ''"
                    :required="f.type === 'scale'"
                    @input="minmax(f, 'max', $event)"
                /></label>
              </div>
              <label class="field">Unidad<input v-model="f.unit" maxlength="30" /></label></template
            ><label v-if="f.type === 'choice'" class="field"
              >Opciones separadas por coma<input
                :value="f.options.join(', ')"
                maxlength="1500"
                @input="
                  f.options = ($event.target as HTMLInputElement).value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean)
                " /></label
            ><button
              type="button"
              class="button button-ghost"
              @click="
                template.fields.splice(i, 1);
                mark();
              "
            >
              Eliminar campo
            </button>
          </fieldset>
          <button
            type="button"
            class="button button-ghost"
            :disabled="template.fields.length >= 12"
            @click="addField"
          >
            Añadir campo</button
          ><button class="button button-primary" :disabled="busy || !template.fields.length">
            Guardar borrador</button
          ><button
            type="button"
            class="button button-ghost"
            :disabled="busy || templateDirty || templateRevision === 0"
            @click="publish"
          >
            Publicar versión guardada
          </button>
        </form>
        <form
          v-if="versionId"
          class="followup-stack"
          @submit.prevent="schedule"
          @input="dirty('schedule', true)"
        >
          <p class="muted">
            La programación usa esta versión publicada; los cambios futuros del borrador no alteran
            las respuestas.
          </p>
          <label class="field"
            >Frecuencia<select v-model="frequency">
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select></label
          ><label v-if="frequency === 'weekly'" class="field"
            >Día de la semana<select v-model.number="weekday">
              <option
                v-for="(d, i) in [
                  'Lunes',
                  'Martes',
                  'Miércoles',
                  'Jueves',
                  'Viernes',
                  'Sábado',
                  'Domingo',
                ]"
                :key="d"
                :value="i + 1"
              >
                {{ d }}
              </option>
            </select></label
          ><label v-else class="field"
            >Día del mes<input
              v-model.number="monthDay"
              type="number"
              min="1"
              max="31"
              required
            /><small>Si el mes es más corto, se usa su último día.</small></label
          ><label class="field"
            >Días para responder<input
              v-model.number="windowDays"
              type="number"
              min="1"
              max="14"
              required
          /></label>
          <div class="followup-form-grid">
            <label class="field">Desde<input v-model="startsOn" type="date" required /></label
            ><label class="field"
              >Hasta<input v-model="endsOn" type="date" :min="startsOn" required
            /></label>
          </div>
          <button class="button button-primary" :disabled="busy">Programar para este alumno</button>
        </form>
      </div>
    </details>
    <div v-for="s in !learner ? data?.schedules : []" :key="s.id" class="followup-inline">
      <span
        >{{ s.name }} · {{ s.frequency === 'weekly' ? 'Semanal' : 'Mensual' }} ·
        {{ s.cancelled ? 'Cancelado' : 'Activo' }}</span
      ><button
        v-if="!s.cancelled && thread.canWrite"
        class="button button-ghost"
        :disabled="busy"
        @click="
          act(async () => {
            await apiRequest(root + '/assignments/' + s.id + '/cancel', {
              method: 'POST',
              body: { kind: 'checkin', revision: s.revision },
            });
          })
        "
      >
        Cancelar programación
      </button>
    </div>
    <h3>Check-ins</h3>
    <p v-if="!data?.tasks.length" class="muted">
      No hay check-ins entre los últimos 14 días y los próximos 31.
    </p>
    <FollowupCheckin
      v-for="t in visibleTasks"
      :key="t.id"
      :root="root"
      :thread-id="thread.id"
      :task="t"
      :learner="learner"
      :allowed="hasEntries"
      :consent="canRecord"
      :can-write="thread.canWrite"
      :pdf-enabled="pdfEnabled"
      @dirty="dirty(t.id, $event)"
      @saved="load"
    />
    <p class="muted">
      Los registros sirven para conversar sobre tu proceso. No generan diagnósticos ni objetivos
      automáticos.
    </p>
  </section>
</template>
