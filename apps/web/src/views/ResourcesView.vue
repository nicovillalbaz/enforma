<script setup lang="ts">
import { computed } from 'vue';
import { useStudio } from '../stores/studio';
import ResourceLibrary from '../components/ResourceLibrary.vue';
const studio = useStudio(),
  org = computed(() => studio.currentOrganization);
</script>
<template>
  <ResourceLibrary
    v-if="org"
    :key="org.id"
    :organization-id="org.id"
    :learner="org.role === 'student'"
  />
  <section v-else class="ui-card empty-state">
    <h1>Recursos de tu estudio</h1>
    <p>
      Selecciona un estudio para abrir el material compartido. La demostración no guarda archivos.
    </p>
  </section>
</template>
