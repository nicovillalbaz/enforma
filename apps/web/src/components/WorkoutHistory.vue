<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { UiButton } from '@forma/ui';
import type { WorkoutSession } from '@forma/shared';
import { apiRequest } from '../api';
import { listCachedWorkouts, cacheWorkout, localWorkout } from '../workout-cache';
import { useStudio } from '../stores/studio';
const props = defineProps<{ studentId?: string }>(),
  studio = useStudio(),
  sessions = ref<WorkoutSession[]>([]),
  error = ref(''),
  pending = ref<Record<string, number>>({}),
  cursor = ref<string | null>(null),
  busy = ref(false);
const from = ref(''),
  to = ref(''),
  state = ref('');
const visibleSessions = computed(() =>
  sessions.value.filter(
    (s) =>
      (!from.value || s.scheduledOn >= from.value) &&
      (!to.value || s.scheduledOn <= to.value) &&
      (!state.value || s.state === state.value),
  ),
);
const learner = computed(() => studio.currentOrganization?.role === 'student');
async function load(more = false) {
  if (busy.value || !studio.currentOrganization || !studio.user) return;
  busy.value = true;
  error.value = '';
  try {
    if (learner.value && !more) {
      const cached = await listCachedWorkouts(studio.user.id, studio.currentOrganization.id);
      sessions.value = cached.map(localWorkout);
      pending.value = Object.fromEntries(cached.map((r) => [r.base.id, r.queue.length]));
    }
    const params = new URLSearchParams({
      limit: '10',
      ...(from.value ? { from: from.value } : {}),
      ...(to.value ? { to: to.value } : {}),
      ...(state.value ? { state: state.value } : {}),
      ...(props.studentId ? { studentId: props.studentId } : {}),
      ...(more && cursor.value ? { before: cursor.value } : {}),
    });
    const data = await apiRequest<{ sessions: WorkoutSession[]; nextBefore: string | null }>(
      `/v1/organizations/${studio.currentOrganization.id}/workouts?${params}`,
    );
    cursor.value = data.nextBefore;
    if (learner.value) {
      for (const s of data.sessions) await cacheWorkout(s);
      const cached = await listCachedWorkouts(studio.user.id, studio.currentOrganization.id);
      sessions.value = cached.map(localWorkout);
      pending.value = Object.fromEntries(cached.map((r) => [r.base.id, r.queue.length]));
    } else sessions.value = more ? [...sessions.value, ...data.sessions] : data.sessions;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos consultar el historial.';
  } finally {
    busy.value = false;
  }
}
onMounted(() => void load());
</script>
<template>
  <section class="workout-history">
    <div class="workout-heading">
      <div>
        <h1>{{ learner ? 'Historial' : 'Entrenamientos realizados' }}</h1>
      </div>
      <div class="history-heading-actions">
        <UiButton variant="secondary" :disabled="busy" @click="load()">Actualizar</UiButton>
        <RouterLink to="/progreso" class="text-link">Ver progreso →</RouterLink>
      </div>
    </div>
    <details class="history-filter-details">
      <summary>Filtrar sesiones</summary>
      <form class="progress-filters" @submit.prevent="load()">
        <label class="field">Desde<input v-model="from" type="date" :max="to || undefined" /></label
        ><label class="field"
          >Hasta<input v-model="to" type="date" :min="from || undefined" /></label
        ><label class="field"
          >Estado de sesión<select v-model="state">
            <option value="">Todos</option>
            <option value="planned">Preparada</option>
            <option value="in_progress">En curso</option>
            <option value="completed">Finalizada</option>
          </select></label
        ><UiButton type="submit" variant="secondary" :disabled="busy">Aplicar filtros</UiButton>
      </form>
    </details>
    <p v-if="error" role="status" class="program-notice">
      {{ error }} {{ learner ? 'Se muestran los registros disponibles en este dispositivo.' : '' }}
    </p>
    <p v-if="!visibleSessions.length && !busy" class="ui-card empty-state">
      Todavía no hay sesiones registradas.
    </p>
    <div class="workout-history-list">
      <article v-for="s in visibleSessions" :key="s.id" class="ui-card workout-history-card">
        <header>
          <span class="eyebrow">{{ s.scheduledOn }} · V{{ s.versionNumber }}</span>
          <h2>{{ s.prescription.name }}</h2>
          <p>{{ s.studentName }} · {{ s.programName }}</p>
          <span class="status-badge">{{
            s.state === 'completed'
              ? 'Finalizada'
              : s.state === 'in_progress'
                ? 'En curso'
                : 'Preparada'
          }}</span>
          <p v-if="pending[s.id]" class="workout-pending">
            {{ pending[s.id] }} cambios locales pendientes · el coach aún no los ve
          </p>
          <p v-else class="muted small-text">Confirmado por el servidor</p>
        </header>
        <div class="workout-summary">
          <strong
            >{{ s.sets.filter((r) => r.state === 'recorded').length }} /
            {{ s.sets.length }} series</strong
          ><span>{{
            s.durationSeconds === null
              ? 'Duración al finalizar'
              : `${Math.floor(s.durationSeconds / 60)} min ${s.durationSeconds % 60} s declarados`
          }}</span>
        </div>
        <p v-if="s.notes" class="program-day-note">{{ s.notes }}</p>
        <details>
          <summary>Ver objetivos y valores realizados</summary>
          <ul class="workout-results">
            <li v-for="(r, i) in s.sets" :key="r.entryId + r.setId">
              <strong
                >{{ i + 1 }}.
                {{
                  s.prescription.exercises.find((x) => x.id === r.entryId)?.snapshot?.name
                }}</strong
              ><span
                >Objetivo:
                {{
                  r.metric === 'reps'
                    ? `${r.target.repsMin}–${r.target.repsMax} rep`
                    : r.metric === 'time'
                      ? `${r.target.seconds} s`
                      : `${r.target.distanceMeters} m`
                }}<template v-if="r.target.weightKg !== null">
                  · {{ r.target.weightKg }} kg</template
                ></span
              ><span
                >Realizado:
                <template v-if="r.state === 'recorded'"
                  ><template v-if="r.actual.weightKg !== null"
                    >{{ r.actual.weightKg }} kg · </template
                  >{{ r.actual.reps ?? r.actual.seconds ?? r.actual.distanceMeters }}
                  {{ r.metric === 'reps' ? 'rep' : r.metric === 'time' ? 's' : 'm'
                  }}<template v-if="r.actual.rpe !== null">
                    · Esfuerzo {{ r.actual.rpe }}/10</template
                  ></template
                ><template v-else>{{
                  r.state === 'undone' ? 'Deshecha' : 'Sin registrar'
                }}</template></span
              ><em v-if="r.actual.note">{{ r.actual.note }}</em>
            </li>
          </ul>
        </details>
        <RouterLink
          v-if="learner"
          class="text-link"
          :to="{ path: '/entrenar', query: { id: s.id } }"
          >{{ s.state === 'completed' ? 'Consultar o corregir' : 'Continuar sesión' }} →</RouterLink
        >
      </article>
    </div>
    <UiButton v-if="cursor" variant="secondary" :disabled="busy" @click="load(true)"
      >Cargar anteriores</UiButton
    >
  </section>
</template>
