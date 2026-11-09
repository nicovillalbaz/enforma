<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { UiButton } from '@forma/ui';
import type { MonthlyCoach } from '@forma/shared';
import { useStudio } from '../stores/studio';
import { apiRequest } from '../api';
import { billingDate } from '../billing-date';
import '../monthly.css';
const studio = useStudio(),
  month = ref(billingDate(new Date().toISOString()).slice(0, 7)),
  control = ref<MonthlyCoach>(),
  error = ref(''),
  busy = ref(false);
const money = (v: number | null) =>
  v === null
    ? 'Por acordar'
    : new Intl.NumberFormat('es-PY', {
        style: 'currency',
        currency: 'PYG',
        maximumFractionDigits: 0,
      }).format(v);
async function load() {
  busy.value = true;
  error.value = '';
  try {
    control.value = (
      await apiRequest<{ control: MonthlyCoach }>(
        '/v1/organizations/' +
          studio.currentOrganization!.id +
          '/monthly-control?month=' +
          month.value,
      )
    ).control;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos consultar.';
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>Mi mensualidad</h1>
    </div>
  </div>
  <form class="monthly-toolbar" @submit.prevent="load">
    <label class="field">Mes<input v-model="month" type="month" required :disabled="busy" /></label
    ><UiButton type="submit" :disabled="busy">Consultar mes</UiButton>
  </form>
  <p v-if="error" role="alert" class="form-error">{{ error }}</p>
  <article v-if="control" class="ui-card monthly-card">
    <div class="monthly-facts">
      <span
        >Pago · {{ control.month
        }}<strong>{{ control.paid ? 'Pagado' : 'Pendiente' }}</strong></span
      ><span
        >Precio mensual<strong>{{ money(control.monthlyPricePyg) }}</strong></span
      ><span
        >Alumnos activos / cupo<strong
          >{{ control.activeStudents }} / {{ control.studentLimit }}</strong
        ></span
      ><span
        >Acceso<strong>{{
          control.status === 'suspended' ? 'Suspendido' : 'Habilitado'
        }}</strong></span
      >
    </div>
    <p v-if="!control.manualMode" class="small-text muted">
      La administración debe revisar la configuración mensual de este espacio.
    </p>
  </article>
</template>
