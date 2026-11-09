<script setup lang="ts">
import LiveLibrary from '../components/LiveLibrary.vue';
import StudyRequired from '../components/StudyRequired.vue';
import { useStudio } from '../stores/studio';
const studio = useStudio();
</script>
<template>
  <LiveLibrary v-if="studio.currentOrganization" :key="studio.currentOrganization.id" />
  <StudyRequired v-else title="Ejercicios" />
</template>
