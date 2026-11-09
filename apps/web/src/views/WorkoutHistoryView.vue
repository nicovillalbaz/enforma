<script setup lang="ts">
import { useRoute } from 'vue-router';
import WorkoutHistory from '../components/WorkoutHistory.vue';
import ContextBack from '../components/ContextBack.vue';
import StudyRequired from '../components/StudyRequired.vue';
import { useStudio } from '../stores/studio';
const route = useRoute(),
  studio = useStudio();
</script>
<template>
  <ContextBack />
  <RouterLink
    v-if="studio.currentOrganization?.role === 'student'"
    to="/documentos"
    class="context-back"
    >Mis documentos</RouterLink
  >
  <WorkoutHistory
    v-if="studio.currentOrganization"
    :key="studio.currentOrganization.id + String(route.query.studentId ?? '')"
    :student-id="typeof route.query.studentId === 'string' ? route.query.studentId : undefined"
  />
  <StudyRequired v-else title="Historial" />
</template>
