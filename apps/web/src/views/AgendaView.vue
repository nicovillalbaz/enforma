<script setup lang="ts">
import { computed } from 'vue';
import { useStudio } from '../stores/studio';
import AgendaWorkspace from '../components/AgendaWorkspace.vue';
const studio = useStudio(),
  org = computed(() => studio.currentOrganization);
</script>
<template>
  <AgendaWorkspace
    v-if="org"
    :key="org.id"
    :organization-id="org.id"
    :learner="org.role === 'student'"
    :owner="org.role === 'owner'"
  />
  <section v-else class="ui-card empty-state">
    <h1>Tu agenda</h1>
    <p>Selecciona un estudio para consultar sesiones, reservar y revisar tus avisos.</p>
  </section>
</template>
