<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  parseMinor,
  minorInput,
  formatMinor,
  dateShift,
  type CoachHome,
  type CoachContract,
} from '@forma/shared';
import type { CommerceCommit } from '../commerce-api';
const props = defineProps<{ home: CoachHome; renewal?: CoachContract; commit: CommerceCommit }>(),
  emit = defineEmits<{ dirty: [boolean]; saved: [string]; cancel: [] }>();
const id = crypto.randomUUID(),
  serviceId = ref(props.renewal?.serviceId ?? ''),
  studentId = ref(props.renewal?.studentId ?? ''),
  startsOn = ref(props.renewal ? dateShift(props.renewal.endsOn, 1) : props.home.today),
  step = ref(1),
  busy = ref(false),
  error = ref(''),
  installments = ref<{ dueOn: string; amount: string }[]>([]);
const selected = computed(() =>
    props.home.services.find((s) => s.id === serviceId.value && !s.archived),
  ),
  endsOn = computed(() =>
    selected.value && startsOn.value
      ? dateShift(startsOn.value, selected.value.validityDays - 1)
      : '',
  ),
  sum = computed(() =>
    installments.value.reduce(
      (n, i) => n + (selected.value ? (parseMinor(i.amount, selected.value.currency) ?? NaN) : NaN),
      0,
    ),
  );
function reset() {
  if (selected.value)
    installments.value = [
      {
        dueOn: startsOn.value,
        amount: minorInput(selected.value.priceMinor, selected.value.currency),
      },
    ];
}
watch(serviceId, reset, { immediate: true });
function split() {
  if (!selected.value || installments.value.length >= 24) return;
  const count = installments.value.length + 1,
    base = Math.floor(selected.value.priceMinor / count),
    remainder = selected.value.priceMinor % count;
  if (base < 1) return;
  installments.value = Array.from({ length: count }, (_, i) => ({
    dueOn: dateShift(startsOn.value, i * 30),
    amount: minorInput(base + (i < remainder ? 1 : 0), selected.value!.currency),
  }));
  emit('dirty', true);
}
function next() {
  error.value = '';
  if (!selected.value || !studentId.value || !startsOn.value) {
    error.value = 'Selecciona servicio, alumno y fecha.';
    return;
  }
  step.value = 2;
}
async function save() {
  if (busy.value || !selected.value) return;
  error.value = '';
  if (sum.value !== selected.value.priceMinor) {
    error.value = 'Las cuotas deben sumar exactamente el precio del servicio.';
    return;
  }
  busy.value = true;
  try {
    await props.commit(
      '/contracts/' + id,
      {
        document: {
          studentId: studentId.value,
          serviceId: serviceId.value,
          serviceRevision: selected.value.revision,
          startsOn: startsOn.value,
          renewalOf: props.renewal?.id ?? null,
          installments: installments.value.map((i) => ({
            dueOn: i.dueOn,
            amountMinor: parseMinor(i.amount, selected.value!.currency),
          })),
        },
      },
      'PUT',
    );
    emit('dirty', false);
    emit('saved', id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo registrar.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <form
    class="ui-card commerce-editor commerce-stack"
    @input="emit('dirty', true)"
    @submit.prevent="step === 1 ? next() : save()"
  >
    <header class="commerce-section-title">
      <div>
        <span class="eyebrow"
          >{{ renewal ? 'RENOVACIÓN EXPLÍCITA' : 'NUEVA VENTA' }} · PASO {{ step }} DE 2</span
        >
        <h2>
          {{ step === 1 ? 'Elige el servicio y la persona' : 'Revisa el precio y las cuotas' }}
        </h2>
      </div>
      <button
        type="button"
        class="commerce-button secondary"
        :disabled="busy"
        @click="emit('cancel')"
      >
        Volver
      </button>
    </header>
    <template v-if="step === 1"
      ><div class="commerce-form-grid">
        <label class="commerce-field"
          >Servicio para vender<select v-model="serviceId" :disabled="!!renewal" required>
            <option value="">Seleccionar servicio</option>
            <option v-for="s in home.services.filter((s) => !s.archived)" :key="s.id" :value="s.id">
              {{ s.name }} · {{ formatMinor(s.priceMinor, s.currency) }}
            </option>
          </select></label
        ><label class="commerce-field"
          >Alumno del servicio<select v-model="studentId" :disabled="!!renewal" required>
            <option value="">Seleccionar alumno</option>
            <option v-for="s in home.students" :key="s.id" :value="s.id">
              {{ s.name }} · {{ s.status === 'active' ? 'Activo' : 'Acceso pendiente o pausado' }}
            </option>
            <option
              v-if="renewal && !home.students.some((s) => s.id === renewal?.studentId)"
              :value="renewal.studentId"
            >
              {{ renewal.studentName }}
            </option></select
          ><small
            >Hasta 100 resultados; busca el alumno antes de abrir esta venta. No activa el acceso a
            la app.</small
          ></label
        ><label class="commerce-field"
          >Inicio de vigencia<input
            v-model="startsOn"
            type="date"
            :min="dateShift(home.today, -366)"
            :max="dateShift(home.today, 366)"
            required
        /></label>
        <div v-if="selected" class="commerce-highlight">
          <strong>{{ formatMinor(selected.priceMinor, selected.currency) }}</strong>
          <p>{{ selected.validityDays }} días · finaliza {{ endsOn }}</p>
          <small v-if="selected.sessions"
            >{{ selected.sessions }} sesiones, descontadas manualmente desde asistencias
            confirmadas.</small
          >
        </div>
      </div>
      <p v-if="renewal" class="commerce-muted">
        Renovar usa el precio actual del catálogo. El contrato anterior conserva su saldo y su
        historial.
      </p>
      <button class="commerce-button primary">Continuar a cuotas</button></template
    ><template v-else-if="selected"
      ><div class="commerce-highlight">
        <strong
          >{{ selected.name }} · {{ formatMinor(selected.priceMinor, selected.currency) }}</strong
        >
        <p>{{ startsOn }} → {{ endsOn }}</p>
      </div>
      <article v-for="(item, index) in installments" :key="index" class="commerce-installment">
        <strong>Cuota {{ index + 1 }}</strong
        ><label class="commerce-field"
          >Vence cuota {{ index + 1 }}<input v-model="item.dueOn" type="date" required /></label
        ><label class="commerce-field"
          >Importe cuota {{ index + 1 }}<input v-model="item.amount" inputmode="decimal" required
        /></label>
      </article>
      <div class="commerce-actions">
        <button
          type="button"
          class="commerce-button secondary"
          :disabled="busy || installments.length >= 24"
          @click="split"
        >
          Dividir en {{ installments.length + 1 }} cuotas</button
        ><button
          type="button"
          class="commerce-button secondary"
          :disabled="busy"
          @click="
            reset();
            emit('dirty', true);
          "
        >
          Una sola cuota
        </button>
      </div>
      <p class="commerce-muted">
        Dividir reparte el precio sin perder unidades; propone vencimientos cada 30 días, editables.
        Son compromisos registrados, sin débito automático.
      </p>
      <strong :class="{ 'error-message': sum !== selected.priceMinor }"
        >Total cuotas:
        {{
          Number.isFinite(sum) ? formatMinor(sum, selected.currency) : 'Revisa los importes'
        }}</strong
      >
      <div class="commerce-actions">
        <button type="button" class="commerce-button secondary" :disabled="busy" @click="step = 1">
          Revisar servicio</button
        ><button class="commerce-button primary" :disabled="busy || sum !== selected.priceMinor">
          {{ busy ? 'Registrando…' : 'Confirmar venta' }}
        </button>
      </div></template
    >
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
  </form>
</template>
