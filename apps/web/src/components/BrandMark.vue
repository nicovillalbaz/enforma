<script setup lang="ts">
import { useStudio } from '../stores/studio';
defineProps<{ small?: boolean }>();
const studio = useStudio();
</script>
<template>
  <span class="brand-mark" :class="{ small }" aria-hidden="true"
    ><img v-if="studio.brand.logoUrl" :src="studio.brand.logoUrl" alt="" /><svg
      v-else
      viewBox="0 0 32 32"
      fill="none"
    >
      <path d="M7 25V7h6l7 11V7h6v18h-6L13 14v11Z" fill="currentColor" />
      <path d="M7 7h6l3 4H7Z" fill="white" opacity=".5" /></svg
  ></span>
</template>
<style>
.brand-mark {
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: var(--navy);
  color: #19e7d0;
  flex-shrink: 0;
}
.brand-mark svg {
  width: 28px;
  height: 28px;
}
.brand-mark img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: inherit;
  background: white;
}
.brand-mark.small {
  width: 34px;
  height: 34px;
  border-radius: 10px;
}
.brand-mark.small svg {
  width: 24px;
  height: 24px;
}
</style>
