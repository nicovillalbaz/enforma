<script setup lang="ts">
import { useRoute } from 'vue-router';
import { useStudio } from '../stores/studio';
import StudentExport from '../components/StudentExport.vue';
import PageStep from '../components/PageStep.vue';
import StudyRequired from '../components/StudyRequired.vue';
const route = useRoute();
const studio = useStudio();
</script>
<template>
  <PageStep
    back-label="Ficha del alumno"
    @back="$router.push('/alumnos/' + route.params.studentId)"
  >
    <StudentExport
      v-if="studio.currentOrganization && studio.currentOrganization.role !== 'student'"
    />
    <StudyRequired v-else title="Exportar" />
  </PageStep>
</template>
