<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { habitUnits, habitProgress, type HabitAssignment, type HabitEntry } from '@forma/shared';
import { apiRequest } from '../api';
import { billingDate } from '../billing-date';
const props = defineProps<{
    root: string;
    habit: HabitAssignment;
    entries: HabitEntry[];
    learner: boolean;
    allowed: boolean;
    canWrite: boolean;
  }>(),
  emit = defineEmits<{ saved: []; dirty: [value: boolean] }>(),
  today = billingDate(new Date().toISOString()),
  day = ref(today),
  value = ref<number | string>(''),
  note = ref(''),
  revision = ref(0),
  busy = ref(false),
  error = ref('');
let requestId = crypto.randomUUID(),
  intent = '';
const changed = ref(false);
function mark(value: boolean) {
  changed.value = value;
  emit('dirty', value);
}
const from = new Date(Date.parse(today + 'T12:00:00Z') - 13 * 86400000).toISOString().slice(0, 10),
  progress = computed(() => habitProgress(props.habit, props.entries, from, today));
function loadDay() {
  const e = props.entries.find((e) => e.habitId === props.habit.id && e.day === day.value);
  value.value = e?.value ?? '';
  note.value = e?.note ?? '';
  revision.value = e?.revision ?? 0;
  mark(false);
}
loadDay();
watch(
  () => props.entries,
  () => {
    if (!changed.value) loadDay();
  },
);
async function save() {
  busy.value = true;
  error.value = '';
  try {
    const next = JSON.stringify({ day: day.value, value: value.value, note: note.value });
    if (intent !== next) {
      intent = next;
      requestId = crypto.randomUUID();
    }
    await apiRequest(props.root + '/habits/' + props.habit.id + '/entry', {
      method: 'PUT',
      body: {
        day: day.value,
        value: value.value === '' ? null : Number(value.value),
        note: note.value,
        revision: revision.value,
        requestId,
      },
    });
    revision.value++;
    mark(false);
    emit('saved');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <article class="followup-habit">
    <header class="followup-section-heading">
      <h3>{{ habit.document.name }}</h3>
      <small>{{ habit.cancelled ? 'Cancelado' : habitUnits[habit.document.kind] }}</small>
    </header>
    <p>{{ habit.document.instructions }}</p>
    <p class="muted">
      {{ habit.startsOn }} — {{ habit.endsOn }} · Días:
      {{
        habit.document.weekdays
          .map((d) => ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][d - 1])
          .join(', ')
      }}
    </p>
    <p v-if="allowed" class="followup-progress">
      <strong>{{ progress.recorded }}</strong> / {{ progress.expected }} días registrados en 14
      días<span v-if="progress.met !== null">
        · {{ progress.met }} alcanzan la referencia elegida</span
      >
    </p>
    <p v-if="habit.document.target !== null" class="muted">
      Referencia: {{ habit.document.target }} {{ habitUnits[habit.document.kind] }}.
    </p>
    <p v-else class="muted">Sin objetivo numérico. Registrar un dato es opcional.</p>
    <form
      v-if="learner && allowed && canWrite && !habit.cancelled"
      class="followup-stack"
      @submit.prevent="save"
      @input="mark(true)"
    >
      <label class="field"
        >Fecha<input
          v-model="day"
          type="date"
          :min="habit.startsOn > from ? habit.startsOn : from"
          :max="habit.endsOn < today ? habit.endsOn : today"
          @change="loadDay" /></label
      ><label class="field"
        >Registro · {{ habitUnits[habit.document.kind]
        }}<select v-if="habit.document.kind === 'check'" v-model="value">
          <option value="">Sin dato</option>
          <option :value="1">Hecho</option>
          <option :value="0">No realizado</option></select
        ><select v-else-if="habit.document.kind === 'energy'" v-model="value">
          <option value="">Sin dato</option>
          <option v-for="n in 5" :key="n" :value="n">{{ n }} / 5</option></select
        ><input
          v-else
          v-model="value"
          type="number"
          inputmode="decimal"
          min="0"
          :max="habit.document.kind === 'water' ? 20 : 24"
          step="0.1"
          placeholder="Sin dato" /></label
      ><label class="field"
        >Nota opcional<textarea v-model="note" maxlength="500" rows="2"></textarea>
      </label>
      <p v-if="error" class="error-message" role="alert">{{ error }}</p>
      <button class="button button-primary" :disabled="busy">Guardar registro</button>
      <button type="button" class="button button-ghost" :disabled="busy" @click="loadDay">
        Recargar registro guardado
      </button>
    </form>
    <button
      v-if="!learner && !habit.cancelled && canWrite"
      class="button button-ghost"
      @click="
        async () => {
          try {
            await apiRequest(root + '/assignments/' + habit.id + '/cancel', {
              method: 'POST',
              body: { kind: 'habit', revision: habit.revision },
            });
            emit('saved');
          } catch (e) {
            error = (e as Error).message;
          }
        }
      "
    >
      Cancelar hábito
    </button>
    <p v-if="!learner && error" role="alert">{{ error }}</p>
  </article>
</template>
