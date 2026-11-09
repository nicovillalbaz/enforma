<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useStudio } from '../stores/studio';
import ProgressPanel from '../components/ProgressPanel.vue';
import ProgressRoster from '../components/ProgressRoster.vue';
import ContextBack from '../components/ContextBack.vue';
const studio = useStudio(),
  route = useRoute();
const studentId = computed(() =>
  studio.currentOrganization?.role === 'student'
    ? studio.portal?.id
    : typeof route.query.studentId === 'string'
      ? route.query.studentId
      : undefined,
);
</script>
<template>
  <ContextBack />
  <template v-if="studio.isLive && studio.currentOrganization"
    ><ProgressPanel
      v-if="studentId"
      :key="studio.currentOrganization.id + studentId"
      :student-id="studentId"
    /><ProgressRoster
      v-else-if="studio.currentOrganization.role !== 'student'"
      :key="studio.currentOrganization.id"
    />
    <p v-else role="status">No pudimos cargar el alumno. Actualiza la página.</p></template
  >
  <section v-else class="ui-card empty-state">
    <h1>Progreso conectado a cada sesión.</h1>
    <p>
      Entra en un estudio para consultar resultados reales y gestionar la privacidad de tus
      mediciones.
    </p>
    <RouterLink to="/acceso" class="text-link">Entrar en mi cuenta →</RouterLink>
  </section>
</template>
