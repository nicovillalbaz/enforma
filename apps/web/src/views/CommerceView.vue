<script setup lang="ts">
import { computed } from 'vue';
import { useStudio } from '../stores/studio';
import CommerceWorkspace from '../components/CommerceWorkspace.vue';
const studio = useStudio(),
  org = computed(() => studio.currentOrganization);
</script>
<template>
  <CommerceWorkspace
    v-if="org && ['owner', 'student'].includes(org.role)"
    :key="org.id"
    :organization-id="org.id"
    :owner="org.role === 'owner'"
  />
  <section v-else class="ui-card empty-state">
    <h1>Servicios y pagos</h1>
    <p>
      Selecciona un estudio. La gestión comercial está reservada al propietario; el alumno consulta
      sus propios servicios.
    </p>
  </section>
</template>
