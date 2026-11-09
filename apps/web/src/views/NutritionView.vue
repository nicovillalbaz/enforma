<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useStudio } from '../stores/studio';
import NutritionWorkspace from '../components/NutritionWorkspace.vue';
import ContextBack from '../components/ContextBack.vue';
const studio = useStudio(),
  route = useRoute(),
  org = computed(() => studio.currentOrganization);
const workspaceKey = computed(
  () => `${org.value?.id ?? ''}:${String(route.query.studentId ?? '')}`,
);
</script>
<template>
  <ContextBack />
  <NutritionWorkspace
    v-if="org"
    :key="workspaceKey"
    :organization-id="org.id"
    :learner="org.role === 'student'"
    :owner="org.role === 'owner'"
  />
  <section v-else class="ui-card empty-state">
    <h1>Alimentación en tu estudio</h1>
    <p>
      Selecciona un estudio para consultar menús y diario. La demostración no guarda datos de
      alimentación.
    </p>
  </section>
</template>
