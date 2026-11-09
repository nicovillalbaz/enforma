<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string }>();
</script>
<template>
  <section class="ui-card">
    <header v-if="title" class="ui-card__header">
      <div>
        <h2>{{ title }}</h2>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <slot name="action" />
    </header>
    <slot />
  </section>
</template>
<style>
.ui-card {
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.ui-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 23px 24px 19px;
}
.ui-card__header h2 {
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.35px;
}
.ui-card__header p {
  font-size: 12px;
  color: var(--muted);
  margin-top: 5px;
  line-height: 1.6;
}
@media (max-width: 599px) {
  .ui-card__header {
    padding: 20px 18px 16px;
  }
}
</style>
