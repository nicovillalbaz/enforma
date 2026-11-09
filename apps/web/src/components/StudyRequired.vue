<script setup lang="ts">
import { useStudio } from '../stores/studio';

defineProps<{ title: string }>();
const studio = useStudio();
</script>

<template>
  <section class="study-required">
    <h1>{{ title }}</h1>
    <RouterLink :to="studio.isDemo ? '/registro' : '/crear-estudio'" class="text-link">
      Crear mi estudio →
    </RouterLink>
  </section>
</template>
