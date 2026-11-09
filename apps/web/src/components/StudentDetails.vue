<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  Copy,
  Mail,
  Check,
  Dumbbell,
  Utensils,
  Activity,
  Ruler,
  History,
  Download,
  ArrowUpRight,
} from '@lucide/vue';
import { UiButton } from '@forma/ui';
import type { StudentState } from '@forma/shared';
import { useStudio } from '../stores/studio';
import CoachField from './CoachField.vue';
import { apiRequest } from '../api';
import { billingDate } from '../billing-date';
const today = billingDate(new Date().toISOString());
const studio = useStudio(),
  name = ref(''),
  goal = ref(''),
  reason = ref(''),
  target = ref<StudentState>('paused'),
  busy = ref(false),
  error = ref('');
const record = ref<{
  programs: { id: string; name: string; startsOn: string; endsOn: string; state: string }[];
  menus: {
    id: string;
    snapshot: { name: string };
    startsOn: string;
    endsOn: string;
    state: string;
  }[];
  latestMeasurements: { kind: string; value: number; measuredOn: string }[];
  sessions: { id: string; day: string }[];
  measurementsPrivate: boolean;
}>();
let recordEpoch = 0;
watch(
  () => studio.selectedStudent?.id,
  async (id) => {
    const epoch = ++recordEpoch;
    record.value = undefined;
    if (!id || !studio.currentOrganization) return;
    try {
      const result = await apiRequest<typeof record.value>(
        `/v1/organizations/${studio.currentOrganization.id}/students/${id}/record`,
      );
      if (epoch === recordEpoch) record.value = result;
    } catch {
      // The actions remain available if the compact summary cannot be loaded.
    }
  },
  { immediate: true },
);
watch(
  () => studio.selectedStudent,
  (s) => {
    name.value = s?.name ?? '';
    goal.value = s?.goal ?? '';
    target.value = s?.accessState === 'active' ? 'paused' : s?.userId ? 'active' : 'invited';
  },
  { immediate: true },
);
watch(
  () => studio.selectedStudent?.id,
  () => {
    studio.invitation = null;
  },
  { immediate: true },
);
async function perform(task: () => Promise<unknown>) {
  error.value = '';
  busy.value = true;
  try {
    await task();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos guardar.';
  } finally {
    busy.value = false;
  }
}
async function copy() {
  try {
    await navigator.clipboard.writeText(studio.invitation!.url);
    studio.notify('Enlace copiado. Compártelo solo con este alumno.');
  } catch {
    error.value = 'No pudimos copiar. Puedes seleccionar el enlace manualmente.';
  }
}
</script>
<template>
  <section v-if="studio.selectedStudent">
    <h1>{{ studio.selectedStudent.name }}</h1>
    <p class="detail-line"><Mail :size="16" />{{ studio.selectedStudent.email }}</p>
    <span class="status-badge">{{ studio.selectedStudent.status }}</span>
    <div v-if="record" class="student-record-snapshot">
      <div>
        <small>Rutina vigente</small
        ><strong>{{
          record.programs.find(
            (p) => p.state === 'active' && p.startsOn <= today && p.endsOn >= today,
          )?.name ?? 'Sin asignar'
        }}</strong>
      </div>
      <div>
        <small>Alimentación vigente</small
        ><strong>{{
          record.menus.find((p) => p.state === 'active' && p.startsOn <= today && p.endsOn >= today)
            ?.snapshot.name ?? 'Sin asignar'
        }}</strong>
      </div>
      <div>
        <small>Peso del periodo</small
        ><strong>{{
          record.latestMeasurements.find((m) => m.kind === 'weight')
            ? `${record.latestMeasurements.find((m) => m.kind === 'weight')!.value} kg`
            : record.measurementsPrivate
              ? 'No compartido'
              : 'Sin dato'
        }}</strong>
      </div>
      <div>
        <small>Altura del periodo</small
        ><strong>{{
          record.latestMeasurements.find((m) => m.kind === 'height')
            ? `${record.latestMeasurements.find((m) => m.kind === 'height')!.value} cm`
            : record.measurementsPrivate
              ? 'No compartido'
              : 'Sin dato'
        }}</strong>
      </div>
    </div>
    <nav class="student-record-actions" aria-label="Acciones para este alumno">
      <RouterLink
        v-if="studio.isDemo || studio.selectedStudent.accessState === 'active'"
        :to="{
          path: '/rutinas',
          query: {
            studentId: studio.selectedStudent.id,
            from: '/alumnos/' + studio.selectedStudent.id,
          },
        }"
        ><Dumbbell :size="19" />Rutinas<ArrowUpRight :size="16"
      /></RouterLink>
      <RouterLink
        v-if="studio.isDemo || studio.selectedStudent.accessState === 'active'"
        :to="{
          path: '/alimentacion',
          query: {
            studentId: studio.selectedStudent.id,
            from: '/alumnos/' + studio.selectedStudent.id,
          },
        }"
        ><Utensils :size="19" />Alimentación<ArrowUpRight :size="16"
      /></RouterLink>
      <RouterLink
        :to="{
          path: '/antropometria',
          query: {
            studentId: studio.selectedStudent.id,
            from: '/alumnos/' + studio.selectedStudent.id,
          },
        }"
        ><Ruler :size="19" />Antropometría<ArrowUpRight :size="16"
      /></RouterLink>
      <RouterLink
        :to="{
          path: '/progreso',
          query: {
            studentId: studio.selectedStudent.id,
            from: '/alumnos/' + studio.selectedStudent.id,
            tab: 'measurements',
          },
        }"
        ><Activity :size="19" />Progreso y medidas<ArrowUpRight :size="16"
      /></RouterLink>
      <RouterLink
        :to="{
          path: '/historial',
          query: {
            studentId: studio.selectedStudent.id,
            from: '/alumnos/' + studio.selectedStudent.id,
          },
        }"
        ><History :size="19" />Historial<ArrowUpRight :size="16"
      /></RouterLink>
      <RouterLink :to="'/alumnos/' + studio.selectedStudent.id + '/exportar'"
        ><Download :size="19" />Exportar<ArrowUpRight :size="16"
      /></RouterLink>
    </nav>
    <details class="student-record-settings">
      <summary>Editar ficha</summary>
      <form
        class="settings-form"
        @submit.prevent="
          perform(() =>
            studio.editStudent(
              studio.selectedStudent!.id,
              name,
              goal,
              studio.selectedStudent!.version!,
            ),
          )
        "
      >
        <label class="field"
          >Nombre completo<input v-model="name" minlength="2" maxlength="100" required /></label
        ><CoachField v-model="goal" label="Objetivo" field="student_goal" :maxlength="300" />
        <UiButton type="submit" variant="secondary" :disabled="busy"
          ><Check :size="16" />Guardar ficha</UiButton
        >
      </form>
    </details>
    <details class="student-record-settings">
      <summary>Invitación de acceso</summary>
      <section class="settings-form">
        <UiButton
          variant="secondary"
          :disabled="busy"
          @click="perform(() => studio.createInvitation(studio.selectedStudent!))"
          >Preparar invitación</UiButton
        ><template v-if="studio.invitation"
          ><label class="field"
            >Enlace privado de un solo uso<input :value="studio.invitation.url" readonly
          /></label>
          <p class="muted small-text">
            Vence: {{ new Date(studio.invitation.expiresAt).toLocaleString('es-PY') }} ·
            {{ studio.invitation.delivery }}
          </p>
          <UiButton variant="ghost" @click="copy"
            ><Copy :size="16" />Copiar enlace</UiButton
          ></template
        >
      </section>
    </details>
    <details class="student-record-settings">
      <summary>Gestionar acceso</summary>
      <form
        class="settings-form"
        @submit.prevent="
          perform(() => studio.changeStudentState(studio.selectedStudent!, target, reason))
        "
      >
        <label class="field"
          >Nuevo estado<select v-model="target">
            <option v-if="!studio.selectedStudent.userId" value="invited">Invitado</option>
            <option v-if="studio.selectedStudent.userId" value="active">Activo</option>
            <option value="paused">Pausado</option>
            <option value="archived">Archivado</option>
          </select></label
        ><label class="field"
          >Motivo del cambio<textarea v-model="reason" minlength="3" maxlength="300" required />
        </label>
        <UiButton type="submit" variant="secondary" :disabled="busy">Actualizar acceso</UiButton>
      </form>
    </details>
    <p v-if="error" role="alert" class="form-error">{{ error }}</p>
  </section>
</template>
