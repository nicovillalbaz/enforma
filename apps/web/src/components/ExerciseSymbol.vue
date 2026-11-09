<script setup lang="ts">
import { computed } from 'vue';
import { exerciseSymbols } from '../exercise-symbols';
import { pictogramPose } from '../exercise-pictograms';
const props = withDefaults(defineProps<{ kind?: string | null; phase?: 0 | 1; name?: string }>(), {
  kind: null,
  phase: 0,
  name: '',
});
const symbol = computed(() => exerciseSymbols.find((s) => s.key === props.kind));
const pose = computed(() => pictogramPose(props.kind, props.phase, symbol.value, props.name));
</script>
<template>
  <svg
    class="exercise-symbol"
    viewBox="0 0 120 96"
    role="img"
    :aria-label="`${symbol?.label ?? 'Ejercicio'} · vista ${phase + 1}`"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path class="symbol-floor" :d="pose.floor" />
    <path v-if="pose.pad" class="symbol-pad" :d="pose.pad" />
    <path v-if="pose.scene" class="symbol-equipment" :d="pose.scene" />
    <path v-if="pose.core" class="symbol-core" :d="pose.core" />
    <path v-if="pose.body" class="symbol-body" :d="pose.body" />
    <circle v-if="pose.head" class="symbol-head" :cx="pose.head[0]" :cy="pose.head[1]" r="7" />
    <path v-if="pose.tool" class="symbol-tool" :d="pose.tool" />
    <path v-if="!symbol" class="symbol-equipment" d="M20 51H100M27 51V78M93 51V78" />
  </svg>
</template>
<style>
.exercise-symbol {
  width: 100%;
  height: 100%;
  max-height: 156px;
  color: #14263d;
}
.symbol-floor {
  stroke: #c6d1db;
  stroke-width: 2;
}
.symbol-pad {
  fill: #b6dbe8;
  stroke: #21688c;
  stroke-width: 2;
}
.symbol-equipment {
  stroke: #3980a2;
  stroke-width: 3.5;
}
.symbol-body {
  stroke: currentColor;
  stroke-width: 7;
}
.symbol-core {
  stroke: currentColor;
  stroke-width: 11;
}
.symbol-head {
  fill: currentColor;
  stroke: #fff;
  stroke-width: 1.5;
}
.symbol-tool {
  stroke: #cf6035;
  stroke-width: 4.5;
}
</style>
