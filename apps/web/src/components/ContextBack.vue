<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowLeft } from '@lucide/vue';
const route = useRoute();
const parent = computed(() => {
  const from = route.query.from;
  if (typeof from === 'string' && /^\/alumnos\/[a-z0-9-]{2,40}$/i.test(from)) return from;
  const id = route.query.studentId;
  return typeof id === 'string' && /^[a-z0-9-]{2,40}$/i.test(id) ? '/alumnos/' + id : null;
});
</script>
<template>
  <RouterLink v-if="parent" :to="parent" class="context-back"
    ><ArrowLeft :size="17" />Volver a la ficha</RouterLink
  >
</template>
