<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { ArrowUpRight, RefreshCw, UsersRound, Dumbbell } from '@lucide/vue';
import type { CoachStartOverview } from '@forma/shared';
import { apiRequest } from '../api';
import '../coach-start.css';
const props = defineProps<{ organizationId: string }>(),
  data = ref<CoachStartOverview>(),
  busy = ref(false),
  error = ref('');
let active = true,
  sequence = 0;
const steps = computed(() =>
    data.value
      ? [
          {
            title: 'Tu marca creada',
            description: 'Tu nombre y color están listos. Puedes añadir un logo cuando quieras.',
            done: data.value.brandReady,
            to: '/marca',
            action: 'Revisar mi marca',
          },
          {
            title: 'Correo verificado',
            description: 'Confirma tu correo antes de invitar alumnos.',
            done: data.value.emailVerified,
            to: '/mi-perfil',
            action: 'Revisar mi cuenta',
          },
          {
            title: 'Primer alumno con acceso',
            description: data.value.invitedStudents
              ? `${data.value.invitedStudents} fichas invitadas. Comprueba que acepten su invitación.`
              : 'Crea una ficha e invita a tu alumno con su enlace privado.',
            done: data.value.activeStudents > 0,
            to: '/alumnos',
            action: 'Gestionar alumnos',
          },
          {
            title: 'Una rutina publicada',
            description: 'Prepara tu entrenamiento y publica una versión lista para compartir.',
            done: data.value.publishedPrograms > 0,
            to: '/rutinas',
            action: 'Abrir rutinas',
          },
          {
            title: 'Rutina asignada',
            description: 'Asigna una rutina vigente o próxima a un alumno con acceso activo.',
            done: data.value.currentAssignments > 0,
            to: '/rutinas',
            action: 'Revisar asignaciones',
          },
        ]
      : [],
  ),
  next = computed(() => steps.value.find((s) => !s.done));
async function load() {
  if (busy.value) return;
  const ticket = ++sequence;
  busy.value = true;
  error.value = '';
  try {
    const result = await apiRequest<CoachStartOverview>(
      `/v1/organizations/${props.organizationId}/coach-start`,
    );
    if (active && ticket === sequence) data.value = result;
  } catch (e) {
    if (active) error.value = e instanceof Error ? e.message : 'No pudimos consultar tu inicio.';
  } finally {
    if (active && ticket === sequence) busy.value = false;
  }
}
function visible() {
  if (!document.hidden) void load();
}
onMounted(() => {
  void load();
  document.addEventListener('visibilitychange', visible);
});
onBeforeUnmount(() => {
  active = false;
  sequence++;
  document.removeEventListener('visibilitychange', visible);
});
</script>
<template>
  <section class="coach-space">
    <header class="coach-heading">
      <div>
        <h1>Inicio</h1>
      </div>
      <button
        class="coach-button secondary"
        :disabled="busy"
        aria-label="Actualizar inicio"
        @click="load"
      >
        <RefreshCw :size="17" />Actualizar
      </button>
    </header>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <p v-if="busy && !data" role="status" class="coach-muted">Preparando tu inicio…</p>
    <template v-if="data"
      ><div v-if="next" class="coach-next-action">
        <span>{{ next.title }}</span
        ><RouterLink :to="next.to" class="coach-button primary"
          >{{ next.action }}<ArrowUpRight :size="17"
        /></RouterLink>
      </div>
      <div class="coach-metrics">
        <article class="ui-card">
          <UsersRound :size="21" /><strong>{{ data.activeStudents }}</strong
          ><span>Alumnos con acceso</span>
        </article>
        <article class="ui-card">
          <Dumbbell :size="21" /><strong>{{ data.publishedPrograms }}</strong
          ><span>Rutinas publicadas</span>
        </article>
      </div>
      ></template
    >
  </section>
</template>
