<script setup lang="ts">
import { creator } from '@forma/shared';
</script>
<template>
  <RouterLink to="/informacion" class="creator-signature">{{ creator.signature }}</RouterLink>
</template>
<style scoped>
.creator-signature {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  max-width: 100%;
  font-size: 0.75rem;
  line-height: 1.6;
  color: var(--muted);
  text-decoration: none;
  overflow-wrap: anywhere;
  white-space: normal;
}
.creator-signature:hover {
  color: var(--brand-ink);
}
.creator-signature:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: 3px;
  border-radius: 4px;
}
</style>
