<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { Plus, Search, ArrowUpRight, SlidersHorizontal } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import LiveLibrary from '../components/LiveLibrary.vue';
import LivePrograms from '../components/LivePrograms.vue';
import ContextBack from '../components/ContextBack.vue';
import AvatarChip from '../components/AvatarChip.vue';
import ExerciseSymbol from '../components/ExerciseSymbol.vue';
import { exercises, useStudio } from '../stores/studio';
const route = useRoute();
const studio = useStudio();
const search = ref('');
const status = ref('Todos');
const students = computed(() =>
  studio.students.filter(
    (s) =>
      `${s.name} ${s.program} ${s.goal}`.toLowerCase().includes(search.value.toLowerCase()) &&
      (status.value === 'Todos' || s.status === status.value),
  ),
);
const library = computed(() =>
  exercises.filter((e) =>
    `${e.name} ${e.muscle} ${e.equipment}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
);
const programs = ref([
  {
    name: 'Fuerza sin límites',
    goal: 'Fuerza y técnica',
    weeks: 8,
    days: 4,
    color: 'blue',
    students: 2,
  },
  {
    name: 'Full body, paso a paso',
    goal: 'Bienestar y constancia',
    weeks: 6,
    days: 3,
    color: 'purple',
    students: 1,
  },
  {
    name: 'Construye tu mejor versión',
    goal: 'Hipertrofia',
    weeks: 8,
    days: 4,
    color: 'cyan',
    students: 1,
  },
]);
</script>
<template>
  <ContextBack
    v-if="
      route.path === '/rutinas' && !route.query.edit && !route.query.versions && !route.query.cancel
    "
  />
  <LivePrograms
    v-if="studio.isLive && route.meta.section === 'rutinas' && studio.currentOrganization"
    :key="'programs-' + studio.currentOrganization.id"
  />
  <LiveLibrary
    v-else-if="studio.isLive && route.path === '/ejercicios'"
    :key="studio.currentOrganization!.id"
  /><template v-else>
    <div class="page-heading">
      <div>
        <h1>{{ route.meta.title }}</h1>
      </div>
      <UiButton v-if="route.path === '/alumnos'" @click="studio.showInvite = true"
        ><Plus :size="17" /> Nuevo alumno</UiButton
      ><UiButton v-else @click="$router.push('/registro')"
        ><Plus :size="17" /> Crear mi estudio</UiButton
      >
    </div>
    <div class="search-toolbar">
      <label class="search-field"
        ><Search :size="18" /><input
          v-model="search"
          type="search"
          :placeholder="
            route.path === '/alumnos'
              ? 'Buscar por nombre, programa u objetivo…'
              : 'Buscar en tu biblioteca…'
          "
          aria-label="Buscar" /></label
      ><label v-if="route.path === '/alumnos'" class="filter-select"
        ><SlidersHorizontal :size="16" /><select
          v-model="status"
          aria-label="Filtrar alumnos por estado"
        >
          <option>Todos</option>
          <template v-if="studio.isDemo"
            ><option>Al día</option>
            <option>Por revisar</option>
            <option>Sin actividad</option></template
          ><template v-else
            ><option>Invitado</option>
            <option>Activo</option>
            <option>Pausado</option>
            <option>Archivado</option></template
          >
        </select></label
      >
    </div>
    <template v-if="route.path === '/alumnos'"
      ><div class="student-list-compact">
        <RouterLink
          v-for="student in students"
          :key="student.id"
          :to="'/alumnos/' + student.id"
          class="student-list-row"
        >
          <AvatarChip :initials="student.initials" :color="student.color" />
          <span class="student-list-identity"
            ><strong>{{ student.name }}</strong
            ><small>{{ student.goal || 'Sin objetivo registrado' }}</small></span
          >
          <span
            class="status-badge"
            :class="{
              'status-warning': student.status === 'Por revisar',
              'status-muted': student.status === 'Sin actividad',
            }"
            >{{ student.status }}</span
          >
          <ArrowUpRight :size="17" aria-hidden="true" />
        </RouterLink>
      </div>
      <div v-if="!students.length" class="empty-state">
        <Search :size="30" />
        <h2>No encontramos coincidencias</h2>
        <p>Prueba otro nombre o cambia el filtro.</p>
        <UiButton
          variant="secondary"
          @click="
            search = '';
            status = 'Todos';
          "
          >Limpiar filtros</UiButton
        >
      </div></template
    >
    <div v-else-if="studio.isLive" class="empty-state">
      <h2>Selecciona un estudio para continuar.</h2>
    </div>
    <div v-else-if="route.path === '/rutinas'" class="demo-program-list">
      <article
        v-for="program in programs.filter((p) =>
          p.name.toLowerCase().includes(search.toLowerCase()),
        )"
        :key="program.name"
        class="demo-program-row"
      >
        <h2>{{ program.name }}</h2>
        <p>{{ program.goal }} · {{ program.weeks }} semanas · {{ program.days }} días/semana</p>
      </article>
    </div>
    <div v-else class="demo-exercise-list">
      <details v-for="exercise in library" :key="exercise.id" class="demo-exercise-row">
        <summary>
          <span class="demo-exercise-symbol"
            ><ExerciseSymbol
              :kind="exercise.id === 'press' ? 'bench' : exercise.id"
              :name="exercise.name"
          /></span>
          <span
            ><strong>{{ exercise.name }}</strong
            ><small>{{ exercise.muscle }} · {{ exercise.equipment }}</small></span
          >
        </summary>
        <div class="demo-exercise-detail">
          <div class="demo-exercise-frames">
            <ExerciseSymbol
              :kind="exercise.id === 'press' ? 'bench' : exercise.id"
              :name="exercise.name"
              :phase="0"
            />
            <ExerciseSymbol
              :kind="exercise.id === 'press' ? 'bench' : exercise.id"
              :name="exercise.name"
              :phase="1"
            />
          </div>
          <p>{{ exercise.sets }} series · {{ exercise.reps }} repeticiones en este ejemplo</p>
        </div>
      </details>
      <div v-if="!library.length" class="empty-state">
        <h2>Sin resultados</h2>
        <p>Cambia la búsqueda.</p>
      </div>
    </div>
    <UiButton v-if="studio.nextCursor" variant="secondary" @click="studio.loadMoreStudents"
      >Cargar más alumnos</UiButton
    >
  </template>
</template>
