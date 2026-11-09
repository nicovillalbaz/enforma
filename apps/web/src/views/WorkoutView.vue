<script setup lang="ts">
import WorkoutTraining from '../components/WorkoutTraining.vue';
import StudyRequired from '../components/StudyRequired.vue';
import { useStudio } from '../stores/studio';
const studio = useStudio();
</script>
<template>
  <WorkoutTraining
    v-if="studio.currentOrganization && studio.user"
    :key="studio.user.id + studio.currentOrganization.id"
  />
  <StudyRequired v-else title="Entrenar" />
</template>
