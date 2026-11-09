<script setup lang="ts">
import { confirmAction } from '../action-review';
import { ref, onMounted } from 'vue';
import { UiButton } from '@forma/ui';
import type { MonthlyStudent } from '@forma/shared';
import { useStudio } from '../stores/studio';
import { apiRequest } from '../api';
import { billingDate } from '../billing-date';
import { monthlyIntent } from '../monthly-intent';
import '../monthly.css';
const studio = useStudio(),
  month = ref(billingDate(new Date().toISOString()).slice(0, 7)),
  loadedMonth = ref(''),
  loadedQuery = ref(''),
  q = ref(''),
  rows = ref<MonthlyStudent[]>([]),
  cursor = ref<string | null>(null),
  busy = ref(false),
  error = ref(''),
  notice = ref(''),
  intent = monthlyIntent();
const root = () => '/v1/organizations/' + studio.currentOrganization!.id;
async function load(more = false) {
  more = more && loadedMonth.value === month.value && loadedQuery.value === q.value;
  const data = await apiRequest<{
    students: MonthlyStudent[];
    nextCursor: string | null;
  }>(
    root() +
      '/monthly-students?month=' +
      month.value +
      '&q=' +
      encodeURIComponent(q.value) +
      (more && cursor.value ? '&cursor=' + cursor.value : ''),
  );
  rows.value = more ? [...rows.value, ...data.students] : data.students;
  cursor.value = data.nextCursor;
  loadedMonth.value = month.value;
  loadedQuery.value = q.value;
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
onMounted(() => perform(() => load()));
async function paid(s: MonthlyStudent) {
  if (loadedMonth.value !== month.value)
    throw new Error('Consulta el mes seleccionado antes de marcar el pago.');
  const body = {
    month: loadedMonth.value,
    paid: !s.paid,
    revision: s.paymentRevision,
    reason: 'Estado mensual registrado por el coach',
  };
  const data = await apiRequest<{
    payment: {
      paid: boolean;
      revision: number;
    };
  }>(root() + '/students/' + s.id + '/monthly-payment', {
    method: 'PUT',
    body: { ...body, requestId: intent.for({ id: s.id, ...body }) },
  });
  s.paid = data.payment.paid;
  s.paymentRevision = data.payment.revision;
  intent.clear();
  notice.value = 'Mes guardado. Decide el acceso por separado.';
}
async function access(s: MonthlyStudent) {
  const enabled = s.status === 'active';
  if (
    !(await confirmAction(
      (enabled ? 'Pausar' : 'Habilitar') +
        ' el acceso de ' +
        s.name +
        '? El pago del mes no cambia.',
    ))
  )
    return;
  await apiRequest(root() + '/students/' + s.id + '/state', {
    method: 'PATCH',
    body: {
      status: enabled ? 'paused' : 'active',
      version: s.version,
      reason: 'Acceso mensual decidido por el coach',
    },
  });
  await load();
  await studio.refreshStudents();
  notice.value = 'Acceso actualizado sin borrar entrenamientos.';
}
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>Mensualidades de alumnos</h1>
    </div>
  </div>
  <form class="monthly-toolbar" @submit.prevent="perform(() => load())">
    <label class="field">Mes<input v-model="month" type="month" required :disabled="busy" /></label
    ><label class="field"
      >Buscar alumno<input v-model="q" type="search" maxlength="100" :disabled="busy" /></label
    ><UiButton type="submit" :disabled="busy">Consultar</UiButton>
  </form>
  <p v-if="error" role="alert" class="form-error">{{ error }}</p>
  <p v-if="notice" role="status">{{ notice }}</p>
  <div class="monthly-grid">
    <article v-for="s in rows" :key="s.id" class="ui-card monthly-card">
      <h2>{{ s.name }}</h2>
      <div class="monthly-facts">
        <span
          >{{ loadedMonth }}<strong>{{ s.paid ? 'Pagado' : 'Pendiente' }}</strong></span
        ><span
          >Acceso<strong>{{
            s.status === 'active'
              ? 'Habilitado'
              : s.status === 'invited'
                ? 'Invitación pendiente'
                : s.status === 'archived'
                  ? 'Archivado'
                  : 'Pausado'
          }}</strong></span
        >
      </div>
      <div class="monthly-actions">
        <UiButton :disabled="busy || loadedMonth !== month" @click="perform(() => paid(s))">{{
          s.paid ? 'Marcar pendiente' : 'Marcar pagado'
        }}</UiButton
        ><UiButton
          v-if="s.userId"
          variant="secondary"
          :disabled="busy"
          @click="perform(() => access(s))"
          >{{ s.status === 'active' ? 'Pausar acceso' : 'Habilitar acceso' }}</UiButton
        ><RouterLink v-else to="/alumnos" class="theme-setting">Preparar invitación →</RouterLink>
      </div>
    </article>
  </div>
  <p v-if="!rows.length && !busy" class="ui-card empty-state">No hay alumnos para este filtro.</p>
  <UiButton v-if="cursor" variant="secondary" :disabled="busy" @click="perform(() => load(true))"
    >Cargar más</UiButton
  >
</template>
