<script setup lang="ts">
import { useRouter } from 'vue-router';
import PageStep from '../components/PageStep.vue';
import StudentDocuments from '../components/StudentDocuments.vue';
import StudyRequired from '../components/StudyRequired.vue';
import { useStudio } from '../stores/studio';
const router = useRouter();
const studio = useStudio();
function goBack() {
  const previous = window.history.state?.back;
  if (typeof previous === 'string' && previous.startsWith('/')) router.back();
  else router.push('/alumno');
}
</script>
<template>
  <PageStep back-label="Volver" @back="goBack">
    <StudentDocuments v-if="studio.currentOrganization" />
    <StudyRequired v-else title="Documentos" />
  </PageStep>
</template>
