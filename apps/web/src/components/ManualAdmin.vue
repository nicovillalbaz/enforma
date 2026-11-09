<script setup lang="ts">
import { confirmAction } from '../action-review';
import { ref, computed, onMounted } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { UiButton } from '@forma/ui';
import type { MonthlyCoach } from '@forma/shared';
import { apiRequest } from '../api';
import { billingDate } from '../billing-date';
import { monthlyIntent } from '../monthly-intent';
import '../monthly.css';
const month = ref(billingDate(new Date().toISOString()).slice(0, 7)),
  search = ref(''),
  entries = ref<MonthlyCoach[]>([]),
  selected = ref<MonthlyCoach | null>(null),
  limit = ref(0),
  price = ref<number | string>(''),
  enabled = ref(false),
  reason = ref(''),
  busy = ref(false),
  error = ref(''),
  notice = ref('');
const intent = monthlyIntent(),
  paymentIntent = monthlyIntent();
const filtered = computed(() =>
  entries.value.filter((e) => e.name.toLowerCase().includes(search.value.toLowerCase())),
);
const money = (n: number | null) =>
  n === null
    ? 'Sin definir'
    : new Intl.NumberFormat('es-PY', {
        style: 'currency',
        currency: 'PYG',
        maximumFractionDigits: 0,
      }).format(n);
onBeforeRouteLeave(
  async () =>
    !selected.value ||
    (await confirmAction('Hay una configuración abierta. ¿Salir sin guardarla?')),
);
async function load() {
  entries.value = [];
  entries.value = (
    await apiRequest<{
      coaches: MonthlyCoach[];
    }>('/v1/admin/monthly-coaches?month=' + month.value)
  ).coaches;
}
async function perform(fn: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await fn();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos guardar.';
  } finally {
    busy.value = false;
  }
}
onMounted(() => perform(load));
function edit(e: MonthlyCoach) {
  selected.value = e;
  limit.value = e.studentLimit;
  price.value = e.monthlyPricePyg ?? '';
  enabled.value = e.status !== 'suspended';
  reason.value = '';
  intent.clear();
}
async function save() {
  if (!selected.value) return;
  const body = {
    studentLimit: limit.value,
    monthlyPricePyg: price.value === '' ? null : Number(price.value),
    accessEnabled: enabled.value,
    revision: selected.value.revision,
    reason: reason.value.trim(),
  };
  await apiRequest('/v1/admin/organizations/' + selected.value.id + '/manual-control', {
    method: 'PUT',
    body: { ...body, requestId: intent.for(body) },
  });
  intent.clear();
  selected.value = null;
  notice.value = 'Configuración y acceso guardados.';
  await load();
}
async function paid(e: MonthlyCoach) {
  if (e.month !== month.value)
    throw new Error('Actualiza el mes seleccionado antes de marcar el pago.');
  const body = {
    month: e.month,
    paid: !e.paid,
    revision: e.paymentRevision,
    reason: 'Estado mensual comprobado manualmente',
  };
  await apiRequest('/v1/admin/organizations/' + e.id + '/monthly-payment', {
    method: 'PUT',
    body: { ...body, requestId: paymentIntent.for({ id: e.id, ...body }) },
  });
  paymentIntent.clear();
  notice.value = 'Mes actualizado. El acceso no cambió.';
  await load();
}
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>Coaches y acceso</h1>
    </div>
  </div>
  <form class="monthly-toolbar" @submit.prevent="perform(load)">
    <label class="field"
      >Mes de pago<input
        v-model="month"
        type="month"
        required
        :disabled="busy || !!selected" /></label
    ><label class="field">Buscar coach<input v-model="search" type="search" /></label
    ><UiButton :disabled="busy || !!selected" type="submit">Actualizar</UiButton>
  </form>
  <p v-if="error" role="alert" class="form-error">{{ error }}</p>
  <p v-if="notice" role="status">{{ notice }}</p>
  <section v-if="selected" class="ui-card monthly-card monthly-panel">
    <h2>Configurar {{ selected.name }}</h2>
    <form class="monthly-form" @submit.prevent="perform(save)">
      <label class="field"
        >Precio mensual (PYG, opcional)<input
          v-model="price"
          type="number"
          min="0"
          max="1000000000000"
          step="1"
          inputmode="numeric" /></label
      ><label class="field"
        >Cupo de alumnos habilitados<input
          v-model.number="limit"
          type="number"
          min="0"
          max="5000"
          step="1"
          required
          inputmode="numeric" /></label
      ><label class="monthly-toggle"
        ><input v-model="enabled" type="checkbox" />Habilitar acceso del coach</label
      >
      <p class="small-text muted">
        Suspender bloquea al coach y a todos sus alumnos. Restaurar recupera solo los alumnos
        individualmente activos. No borra entrenamientos. Activos conservados:
        {{ selected.activeStudents }}.
      </p>
      <label class="field"
        >Motivo del cambio<input v-model="reason" required minlength="10" maxlength="500"
      /></label>
      <div class="monthly-actions">
        <UiButton type="submit" :disabled="busy">Guardar configuración</UiButton
        ><UiButton variant="secondary" :disabled="busy" @click="selected = null">Cancelar</UiButton>
      </div>
    </form>
  </section>
  <div class="monthly-grid">
    <article v-for="entry in filtered" :key="entry.id" class="ui-card monthly-card">
      <h2>{{ entry.name }}</h2>
      <div class="monthly-facts">
        <span
          >Acceso<strong>{{
            entry.status === 'suspended' ? 'Suspendido' : 'Habilitado'
          }}</strong></span
        ><span
          >Mensualidad<strong>{{ money(entry.monthlyPricePyg) }}</strong></span
        ><span
          >Cupo<strong>{{ entry.activeStudents }} / {{ entry.studentLimit }}</strong></span
        ><span
          >Pago<strong>{{ entry.paid ? 'Pagado' : 'Pendiente' }}</strong></span
        >
      </div>
      <p v-if="!entry.manualMode" class="small-text muted">
        Configuración anterior: revisar precio, cupo y acceso.
      </p>
      <div class="monthly-actions">
        <UiButton :disabled="busy || !!selected" @click="edit(entry)">Configurar coach</UiButton
        ><UiButton
          variant="secondary"
          :disabled="busy || !!selected"
          @click="perform(() => paid(entry))"
          >{{ entry.paid ? 'Marcar pendiente' : 'Marcar pagado' }}</UiButton
        >
      </div>
    </article>
  </div>
  <p v-if="!filtered.length && !busy && !error" class="ui-card empty-state">
    No hay coaches para mostrar.
  </p>
</template>
