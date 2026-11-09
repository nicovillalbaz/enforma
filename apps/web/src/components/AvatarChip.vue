<script setup lang="ts">
defineProps<{ initials: string; color?: string; small?: boolean }>();
</script>
<template>
  <span class="avatar-chip" :class="[color ?? 'blue', { small }]">{{ initials }}</span>
</template>
<style>
.avatar-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 650;
  color: #34547d;
  background: #e9f0ff;
  flex-shrink: 0;
}
.avatar-chip.peach {
  background: #fce8dc;
  color: #975e4b;
}
.avatar-chip.purple {
  background: #edeafb;
  color: #716098;
}
.avatar-chip.green {
  background: #e3f3e7;
  color: #477257;
}
.avatar-chip.small {
  width: 30px;
  height: 30px;
  font-size: 10px;
}
</style>
