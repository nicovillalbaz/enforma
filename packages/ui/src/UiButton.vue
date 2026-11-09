<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost';
    type?: 'button' | 'submit';
    disabled?: boolean;
  }>(),
  { variant: 'primary', type: 'button', disabled: false },
);
</script>
<template>
  <button :type="type" :disabled="disabled" class="ui-button" :class="`ui-button--${variant}`">
    <slot />
  </button>
</template>
<style>
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 11px 17px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.4;
  transition:
    background 0.15s,
    transform 0.15s;
  white-space: normal;
}
.ui-button:active {
  transform: translateY(1px);
}
.ui-button svg {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
}
.ui-button--primary {
  background: var(--brand);
  color: var(--brand-text);
}
.ui-button--primary:hover {
  filter: brightness(1.08);
}
.ui-button--secondary {
  color: var(--text);
  background: var(--surface);
  border-color: var(--line);
}
.ui-button--secondary:hover {
  background: var(--surface-soft);
}
.ui-button--ghost {
  color: var(--muted);
  background: transparent;
}
.ui-button--ghost:hover {
  background: var(--surface-soft);
}
</style>
