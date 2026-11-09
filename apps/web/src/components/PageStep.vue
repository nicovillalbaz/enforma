<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue';
withDefaults(defineProps<{ title?: string; backLabel?: string }>(), {
  title: '',
  backLabel: 'Volver',
});
const emit = defineEmits<{ back: [] }>();
</script>
<template>
  <section class="flow-page">
    <header class="flow-heading">
      <button type="button" class="text-button flow-back" @click="emit('back')">
        <ArrowLeft :size="17" />{{ backLabel }}
      </button>
      <h1 v-if="title">{{ title }}</h1>
    </header>
    <slot />
  </section>
</template>
