<script setup lang="ts">
import { ref, watch } from 'vue';
import type { AgendaPreferences } from '@forma/shared';
import type { AgendaCommit } from '../agenda-api';
const props = defineProps<{
    preferences: AgendaPreferences;
    timezone: string;
    commit: AgendaCommit;
  }>(),
  emit = defineEmits<{ saved: []; dirty: [value: boolean] }>(),
  draft = ref({ ...props.preferences }),
  busy = ref(false),
  error = ref(''),
  changed = ref(false);
const time = (n: number) =>
    String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'),
  from = ref(time(draft.value.quietStart)),
  to = ref(time(draft.value.quietEnd));
watch(
  () => props.preferences,
  (value) => {
    if (changed.value) return;
    draft.value = { ...value };
    from.value = time(value.quietStart);
    to.value = time(value.quietEnd);
  },
);
function mark() {
  changed.value = true;
  emit('dirty', true);
}
async function save() {
  busy.value = true;
  error.value = '';
  try {
    const minutes = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3)),
      { revision, ...document } = draft.value;
    await props.commit(
      '/preferences',
      {
        revision,
        document: { ...document, quietStart: minutes(from.value), quietEnd: minutes(to.value) },
      },
      'PUT',
    );
    changed.value = false;
    emit('dirty', false);
    emit('saved');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="ui-card agenda-preferences">
    <h2>Tus avisos, a tu ritmo</h2>
    <p class="agenda-muted">
      Preferencias de avisos internos de este estudio. El silencio de una conversación también se
      respeta para los recordatorios de sus check-ins.
    </p>
    <form class="agenda-stack" @submit.prevent="save" @input="mark">
      <fieldset>
        <legend>Categorías</legend>
        <label
          v-for="category in ['booking', 'change', 'reminder', 'welcome', 'checkin'] as const"
          :key="category"
          class="agenda-check"
          ><input v-model="draft[category]" type="checkbox" />{{
            {
              booking: 'Reservas y cancelaciones',
              change: 'Cambios de sesión',
              reminder: 'Próximas sesiones',
              welcome: 'Bienvenida',
              checkin: 'Check-ins pendientes',
            }[category]
          }}</label
        >
      </fieldset>
      <div class="agenda-form-grid">
        <label class="agenda-field"
          >Descanso desde<input v-model="from" type="time" required /></label
        ><label class="agenda-field"
          >Descanso hasta<input v-model="to" type="time" required
        /></label>
      </div>
      <p class="agenda-muted">
        Zona {{ timezone }}. Durante el descanso, los avisos esperan si su ventana lo permite. Dos
        horas iguales desactivan esta franja.
      </p>
      <label class="agenda-field"
        >Máximo de avisos por día<input
          v-model.number="draft.dailyLimit"
          type="number"
          min="1"
          max="20"
          required
      /></label>
      <p v-if="error" class="error-message" role="alert">{{ error }}</p>
      <button class="agenda-button primary" :disabled="busy">Guardar preferencias de avisos</button>
    </form>
  </section>
</template>
