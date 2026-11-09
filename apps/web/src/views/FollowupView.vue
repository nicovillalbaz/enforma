<script setup lang="ts">
import { computed } from 'vue';
import { useStudio } from '../stores/studio';
import FollowupWorkspace from '../components/FollowupWorkspace.vue';
const studio = useStudio(),
  org = computed(() => studio.currentOrganization);
</script>
<template>
  <FollowupWorkspace
    v-if="org && studio.user"
    :key="org.id"
    :organization-id="org.id"
    :user-id="studio.user.id"
    :learner="org.role === 'student'"
  />
  <section v-else class="ui-card empty-state">
    <h1>Chat y seguimiento</h1>
    <p>Selecciona tu estudio para conversar con tu profesional y consultar hábitos y check-ins.</p>
  </section>
</template>
