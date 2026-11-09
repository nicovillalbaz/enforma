<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Download, FileText, RefreshCw } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import type { ResourceDetail } from '@forma/shared';
import { apiRequest } from '../api';
import { useStudio } from '../stores/studio';

const route = useRoute();
const studio = useStudio();
const studentId = String(route.params.studentId);
const organizationId = studio.currentOrganization!.id;
const root = `/v1/organizations/${organizationId}`;
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Asuncion',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const from = ref(
  new Date(Date.parse(today + 'T12:00:00Z') - 29 * 86400000).toISOString().slice(0, 10),
);
const to = ref(today);
const kind = ref<'all' | 'training' | 'nutrition' | 'measurements'>('all');
const pdfKind = ref<'history' | 'report' | 'routine' | 'menu'>('history');
const assignmentId = ref('');
const busy = ref(false);
const error = ref('');
const notice = ref('');
const record = ref<{
  student: { name: string };
  programs: { id: string; name: string; startsOn: string; endsOn: string; state: string }[];
  menus: {
    id: string;
    snapshot: { name: string };
    startsOn: string;
    endsOn: string;
    state: string;
  }[];
  measurements: unknown[];
  sessions: unknown[];
  measurementsPrivate: boolean;
}>();
const resourceDetail = ref<ResourceDetail>();
let documentRequest = crypto.randomUUID();
let versionRequest = crypto.randomUUID();
let previewEpoch = 0;
const pdfAssignments = computed(() =>
  pdfKind.value === 'routine' ? record.value?.programs : record.value?.menus,
);
const query = computed(
  () => new URLSearchParams({ from: from.value, to: to.value, kind: kind.value }),
);
watch([from, to, kind], () => {
  previewEpoch++;
  record.value = undefined;
  resourceDetail.value = undefined;
  assignmentId.value = '';
  notice.value = '';
  documentRequest = crypto.randomUUID();
  versionRequest = crypto.randomUUID();
});
watch([pdfKind, assignmentId], () => {
  resourceDetail.value = undefined;
  notice.value = '';
  documentRequest = crypto.randomUUID();
  versionRequest = crypto.randomUUID();
});
async function preview() {
  const epoch = ++previewEpoch;
  busy.value = true;
  error.value = '';
  try {
    const result = await apiRequest<NonNullable<typeof record.value>>(
      `${root}/students/${studentId}/record?${query.value}`,
    );
    if (epoch === previewEpoch) record.value = result;
  } catch (e) {
    if (epoch === previewEpoch)
      error.value = e instanceof Error ? e.message : 'No pudimos consultar el periodo.';
  } finally {
    if (epoch === previewEpoch) busy.value = false;
  }
}
async function downloadExcel() {
  busy.value = true;
  error.value = '';
  try {
    const response = await fetch(`${root}/students/${studentId}/export.xlsx?${query.value}`, {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? 'No pudimos preparar el Excel.');
    }
    const link = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.download = `alumno-${from.value}-${to.value}.xlsx`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(link), 60000);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos descargar el Excel.';
  } finally {
    busy.value = false;
  }
}
async function generatePdf() {
  if ((pdfKind.value === 'routine' || pdfKind.value === 'menu') && !assignmentId.value) return;
  busy.value = true;
  error.value = '';
  try {
    const label = {
      history: 'Historial de entrenamiento',
      report: 'Progreso y mediciones',
      routine: 'Rutina',
      menu: 'Alimentación',
    }[pdfKind.value];
    const created = await apiRequest<ResourceDetail>(root + '/resources', {
      method: 'POST',
      body: {
        requestId: documentRequest,
        name: `${label} · ${record.value?.student.name ?? 'Alumno'} · ${from.value}`.slice(0, 100),
        description: `${from.value} al ${to.value}`,
        collectionId: null,
      },
    });
    const id = created.resource.id;
    const result = await apiRequest<{ versionId: string }>(root + `/resources/${id}/versions`, {
      method: 'POST',
      body: {
        requestId: versionRequest,
        kind: pdfKind.value,
        studentId,
        ...(pdfKind.value === 'routine' || pdfKind.value === 'menu'
          ? { assignmentId: assignmentId.value }
          : { from: from.value, to: to.value }),
      },
    });
    await apiRequest(root + `/resources/${id}/access`, {
      method: 'POST',
      body: { studentId, grant: true },
    });
    resourceDetail.value = await apiRequest<ResourceDetail>(root + `/resources/${id}`);
    notice.value = `PDF solicitado. Versión ${result.versionId.slice(0, 8)}. Actualiza el estado para descargarlo.`;
    documentRequest = crypto.randomUUID();
    versionRequest = crypto.randomUUID();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos generar el PDF.';
  } finally {
    busy.value = false;
  }
}
async function refreshDocument() {
  if (!resourceDetail.value) return;
  busy.value = true;
  try {
    resourceDetail.value = await apiRequest<ResourceDetail>(
      root + `/resources/${resourceDetail.value.resource.id}`,
    );
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos consultar el documento.';
  } finally {
    busy.value = false;
  }
}
async function downloadPdf(versionId: string) {
  if (!resourceDetail.value) return;
  try {
    const link = await apiRequest<{ url: string }>(
      root + `/resources/${resourceDetail.value.resource.id}/versions/${versionId}/link`,
      { method: 'POST' },
    );
    window.location.assign(link.url + '?download=1');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos abrir el PDF.';
  }
}
onMounted(preview);
</script>

<template>
  <section class="student-export">
    <h1>Exportar {{ record?.student.name ?? 'alumno' }}</h1>
    <form class="student-export-filters" @submit.prevent="preview">
      <label class="field"
        >Desde<input v-model="from" type="date" :max="to" :disabled="busy" required
      /></label>
      <label class="field"
        >Hasta<input v-model="to" type="date" :min="from" :max="today" :disabled="busy" required
      /></label>
      <label class="field"
        >Contenido<select v-model="kind" :disabled="busy">
          <option value="all">Todo</option>
          <option value="training">Entrenamiento</option>
          <option value="nutrition">Alimentación</option>
          <option value="measurements">Mediciones</option>
        </select></label
      >
      <UiButton type="submit" variant="secondary" :disabled="busy">Ver contenido</UiButton>
    </form>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <div v-if="record" class="student-export-counts">
      <span>{{ record.programs.length }} rutinas</span
      ><span>{{ record.sessions.length }} sesiones</span>
      <span>{{ record.menus.length }} planes de alimentación</span
      ><span>{{ record.measurements.length }} mediciones</span>
    </div>
    <p v-if="record?.measurementsPrivate" class="muted small-text">
      Las mediciones del alumno solo se incluyen si comparte su historial.
    </p>
    <UiButton v-if="record" :disabled="busy" @click="downloadExcel"
      ><Download :size="17" />Descargar Excel</UiButton
    >
    <section v-if="record" class="student-export-pdf">
      <h2>PDF</h2>
      <label class="field"
        >Documento<select v-model="pdfKind" :disabled="busy" @change="assignmentId = ''">
          <option value="history">Historial de entrenamiento del periodo</option>
          <option value="report">Progreso y mediciones del periodo</option>
          <option value="routine">Rutina asignada</option>
          <option value="menu">Plan de alimentación asignado</option>
        </select></label
      >
      <label v-if="pdfKind === 'routine' || pdfKind === 'menu'" class="field"
        >Asignación<select v-model="assignmentId" :disabled="busy" required>
          <option value="" disabled>Elegir asignación</option>
          <option v-for="a in pdfAssignments" :key="a.id" :value="a.id">
            {{ 'name' in a ? a.name : a.snapshot.name }} · {{ a.startsOn }} — {{ a.endsOn }}
          </option>
        </select></label
      >
      <UiButton
        :disabled="busy || ((pdfKind === 'routine' || pdfKind === 'menu') && !assignmentId)"
        @click="generatePdf"
        ><FileText :size="17" />Generar y compartir PDF</UiButton
      >
    </section>
    <section v-if="resourceDetail" class="student-export-document" aria-live="polite">
      <h2>{{ resourceDetail.resource.name }}</h2>
      <UiButton variant="secondary" :disabled="busy" @click="refreshDocument"
        ><RefreshCw :size="16" />Actualizar estado</UiButton
      >
      <div v-for="version in resourceDetail.versions" :key="version.id">
        <span>{{
          version.state === 'ready' ? 'Listo' : version.state === 'failed' ? 'Falló' : 'Preparando'
        }}</span>
        <UiButton
          v-if="version.state === 'ready'"
          variant="secondary"
          @click="downloadPdf(version.id)"
          ><Download :size="16" />Descargar PDF</UiButton
        >
      </div>
    </section>
  </section>
</template>
