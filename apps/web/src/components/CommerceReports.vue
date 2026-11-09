<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { formatMinor, type CoachSummary } from '@forma/shared';
import { apiRequest } from '../api';
const props = defineProps<{ root: string; today: string }>(),
  from = ref(props.today.slice(0, 8) + '01'),
  to = ref(props.today),
  rows = ref<CoachSummary[]>([]),
  error = ref(''),
  busy = ref(false),
  loadedFrom = ref(''),
  loadedTo = ref('');
let active = true;
const csvUrl = computed(
  () =>
    props.root +
    '/reports?' +
    new URLSearchParams({ from: loadedFrom.value, to: loadedTo.value, csv: '1' }),
);
async function load() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const r = await apiRequest<{ summary: CoachSummary[] }>(
      props.root + '/reports?' + new URLSearchParams({ from: from.value, to: to.value }),
    );
    if (active) {
      rows.value = r.summary;
      loadedFrom.value = from.value;
      loadedTo.value = to.value;
    }
  } catch (e) {
    if (active) error.value = e instanceof Error ? e.message : 'No se pudo cargar.';
  } finally {
    if (active) busy.value = false;
  }
}
onMounted(() => void load());
onBeforeUnmount(() => {
  active = false;
});
</script>
<template>
  <section class="commerce-stack">
    <header class="ui-card commerce-toolbar">
      <form class="commerce-search" @submit.prevent="load">
        <label class="commerce-field"
          >Resumen desde<input v-model="from" type="date" required /></label
        ><label class="commerce-field"
          >Resumen hasta<input v-model="to" type="date" required /></label
        ><button class="commerce-button primary" :disabled="busy">Consultar resumen</button>
      </form>
      <a v-if="loadedFrom" class="commerce-button secondary" :href="csvUrl" download
        >Exportar resumen CSV</a
      >
    </header>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <p class="commerce-muted">
      Periodo consultado: {{ loadedFrom || '…' }} → {{ loadedTo || '…' }}. Cada moneda se informa
      por separado; no hay conversiones ni suma de monedas distintas.
    </p>
    <div class="commerce-summary-grid">
      <article v-for="r in rows" :key="r.currency" class="ui-card commerce-summary">
        <span class="eyebrow">{{ r.currency }} · RESUMEN</span>
        <h2>{{ formatMinor(r.netMinor, r.currency) }}</h2>
        <p class="commerce-muted">Cobrado neto registrado en el periodo</p>
        <dl>
          <div>
            <dt>Pagos confirmados</dt>
            <dd>{{ formatMinor(r.grossMinor, r.currency) }}</dd>
          </div>
          <div>
            <dt>Devoluciones reales</dt>
            <dd>{{ formatMinor(r.refundsMinor, r.currency) }}</dd>
          </div>
          <div>
            <dt>Precio de ventas nuevas</dt>
            <dd>{{ formatMinor(r.salesMinor, r.currency) }}</dd>
          </div>
          <div>
            <dt>Saldo de cuotas del periodo</dt>
            <dd>{{ formatMinor(r.dueMinor, r.currency) }}</dd>
          </div>
          <div>
            <dt>De ese saldo, vencido hoy</dt>
            <dd>{{ formatMinor(r.overdueMinor, r.currency) }}</dd>
          </div>
          <div>
            <dt>Ventas / cancelaciones / vencimientos</dt>
            <dd>{{ r.sales }} / {{ r.cancellations }} / {{ r.expirations }}</dd>
          </div>
        </dl>
      </article>
    </div>
    <section class="ui-card commerce-stack">
      <h2>Cómo leer estas cifras</h2>
      <p>
        Pagos y devoluciones usan su fecha declarada. Un pago anulado por registro equivocado queda
        excluido del cobro confirmado. Una devolución puede corresponder a un pago anterior y
        producir neto negativo en este periodo.
      </p>
      <p>
        Ventas nuevas usa fecha de registro y precio original congelado: es un compromiso comercial,
        no dinero cobrado. Las cancelaciones usan su fecha de cancelación; vencimientos cuenta
        contratos sin cancelar cuyo último día ya pasó.
      </p>
      <p>
        Saldo y vencido muestran el estado actual de las cuotas cuya fecha de vencimiento cae en el
        periodo elegido. No reconstruyen un balance histórico a esa fecha. Cancelar un contrato
        conserva su deuda hasta registrar ajustes/devoluciones.
      </p>
      <p class="commerce-muted">
        Registro interno de gestión. No constituye factura fiscal ni conciliación bancaria.
      </p>
    </section>
  </section>
</template>
