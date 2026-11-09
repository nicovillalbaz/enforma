<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ArrowUpRight } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import type { ProgressRosterStudent } from '@forma/shared';
import { apiRequest } from '../api';
import { useStudio } from '../stores/studio';
const studio = useStudio(),
  students = ref<ProgressRosterStudent[]>([]),
  query = ref(''),
  cursor = ref<string | null>(null),
  busy = ref(false),
  error = ref('');
const number = (n: number) =>
  new Intl.NumberFormat('es-PY', { maximumFractionDigits: 1 }).format(n);
async function load(more = false) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const data = await apiRequest<{ students: ProgressRosterStudent[]; nextCursor: string | null }>(
      `/v1/organizations/${studio.currentOrganization!.id}/progress?` +
        new URLSearchParams({
          q: query.value,
          limit: '20',
          ...(more && cursor.value ? { cursor: cursor.value } : {}),
        }),
    );
    students.value = more ? [...students.value, ...data.students] : data.students;
    cursor.value = data.nextCursor;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos consultar el seguimiento.';
  } finally {
    busy.value = false;
  }
}
onMounted(() => void load());
</script>
<template>
  <section class="progress-roster">
    <header class="progress-heading">
      <div>
        <h1>Progreso</h1>
        <p class="muted">Últimos 28 días</p>
      </div>
    </header>
    <form class="progress-filters" @submit.prevent="load()">
      <label class="field"
        >Buscar alumno<input
          v-model="query"
          type="search"
          maxlength="100"
          placeholder="Nombre del alumno" /></label
      ><UiButton type="submit" variant="secondary" :disabled="busy">Buscar</UiButton>
    </form>
    <p v-if="error" role="alert" class="form-error">{{ error }}</p>
    <p v-if="busy" role="status">Cargando progreso…</p>
    <p v-if="!busy && !students.length && !error" class="ui-card empty-state">
      No hay alumnos que coincidan con esta búsqueda.
    </p>
    <div class="progress-roster-grid">
      <article v-for="s in students" :key="s.id" class="ui-card progress-student-card">
        <header>
          <span class="eyebrow">{{
            s.status === 'active' ? 'ACTIVO' : s.status === 'paused' ? 'PAUSADO' : 'INVITADO'
          }}</span>
          <h2>{{ s.name }}</h2>
        </header>
        <div class="progress-roster-numbers">
          <div>
            <strong>{{ s.sessions }}</strong
            ><span>sesiones finalizadas</span>
          </div>
          <div>
            <strong>{{ number(s.volumeKgReps) }}</strong
            ><span>kg·rep conocidos</span>
          </div>
        </div>
        <p class="muted small-text">
          {{
            s.activity.lastCompletedAt
              ? 'Último cierre: ' +
                new Intl.DateTimeFormat('es-PY', {
                  dateStyle: 'medium',
                  timeZone: 'America/Asuncion',
                }).format(new Date(s.activity.lastCompletedAt))
              : 'Todavía sin sesiones finalizadas.'
          }}
        </p>
        <p v-if="s.activity.flagged" class="progress-flag">
          Revisar planificación · {{ s.activity.daysInactive }} días sin cierre
        </p>
        <RouterLink class="text-link" :to="{ path: '/progreso', query: { studentId: s.id } }"
          >Ver progreso <ArrowUpRight :size="17"
        /></RouterLink>
      </article>
    </div>
    <UiButton v-if="cursor" variant="secondary" :disabled="busy" @click="load(true)"
      >Cargar más alumnos</UiButton
    >
  </section>
</template>
