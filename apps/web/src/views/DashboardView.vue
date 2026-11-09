<script setup lang="ts">
import { computed } from 'vue';
import { ArrowRight } from '@lucide/vue';
import LiveDashboard from '../components/LiveDashboard.vue';
import CoachStart from '../components/CoachStart.vue';
import { useStudio } from '../stores/studio';

const studio = useStudio();
const examples = computed(() => studio.students.slice(0, 6));
</script>

<template>
  <CoachStart
    v-if="studio.isLive && studio.currentOrganization?.role === 'owner'"
    :key="studio.currentOrganization.id"
    :organization-id="studio.currentOrganization.id"
  />
  <LiveDashboard v-else-if="studio.isLive" />
  <section v-else class="demo-start">
    <header class="compact-heading">
      <h1>Inicio</h1>
      <span class="preview-badge">Datos de ejemplo</span>
    </header>
    <section class="demo-list">
      <div class="compact-heading">
        <h2>Alumnos</h2>
        <RouterLink to="/alumnos" class="text-link">Ver todos <ArrowRight :size="16" /></RouterLink>
      </div>
      <RouterLink
        v-for="student in examples"
        :key="student.id"
        :to="'/alumnos/' + student.id"
        class="demo-student"
      >
        <span
          ><strong>{{ student.name }}</strong
          ><small>{{ student.goal || 'Sin objetivo registrado' }}</small></span
        >
        <ArrowRight :size="17" />
      </RouterLink>
    </section>
  </section>
</template>
