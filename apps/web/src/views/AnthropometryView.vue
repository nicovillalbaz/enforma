<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useStudio } from '../stores/studio';
import ContextBack from '../components/ContextBack.vue';
import AnthropometryWorkspace from '../components/AnthropometryWorkspace.vue';
const studio = useStudio();
const route = useRoute();
const org = computed(() => studio.currentOrganization);
const studentId = computed(() =>
  org.value?.role === 'student'
    ? studio.portal?.id
    : typeof route.query.studentId === 'string'
      ? route.query.studentId
      : '',
);
</script>
<template>
  <ContextBack />
  <AnthropometryWorkspace
    v-if="org && studentId"
    :key="org.id + studentId"
    :organization-id="org.id"
    :student-id="studentId"
    :owner="org.role === 'owner'"
  />
  <section v-else class="ui-card empty-state">
    Abre la ficha de un alumno para consultar sus evaluaciones.
  </section>
</template>
