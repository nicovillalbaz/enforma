<script setup lang="ts">
import StudentPrograms from '../components/StudentPrograms.vue';
import StudyRequired from '../components/StudyRequired.vue';
import { useStudio } from '../stores/studio';
const studio = useStudio();
</script>
<template>
  <StudentPrograms v-if="studio.currentOrganization" :key="studio.currentOrganization.id" />
  <StudyRequired v-else title="Mi programa" />
</template>
