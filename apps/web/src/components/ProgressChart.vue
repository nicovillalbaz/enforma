<script setup lang="ts">
import { computed, useId, ref, onMounted, onBeforeUnmount } from 'vue';
const props = defineProps<{
    title: string;
    unit: string;
    points: { label: string; value: number | null }[];
    zero?: boolean;
  }>(),
  id = useId();
const figure = ref<HTMLElement>(),
  width = ref(320);
let observer: ResizeObserver | undefined,
  frame = 0;
onMounted(() => {
  observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect;
    if (!rect) return;
    const next = Math.max(200, Math.min(620, Math.round(rect.width)));
    if (next === width.value) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      width.value = next;
    });
  });
  if (figure.value) observer.observe(figure.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  cancelAnimationFrame(frame);
});
const defined = computed(() => props.points.flatMap((p) => (p.value === null ? [] : [p.value])));
const min = computed(() =>
  props.zero
    ? 0
    : Math.max(
        0,
        Math.min(...defined.value) -
          Math.max(1, (Math.max(...defined.value) - Math.min(...defined.value)) * 0.15),
      ),
);
const max = computed(() => Math.max(min.value + 1, Math.max(...defined.value) * 1.08));
const xy = (index: number, value: number) => ({
  x: 54 + (index / Math.max(1, props.points.length - 1)) * (width.value - 70),
  y: 178 - ((value - min.value) / (max.value - min.value)) * 145,
});
const path = computed(() => {
  let pen = false;
  return props.points
    .map((p, i) => {
      if (p.value === null) {
        pen = false;
        return '';
      }
      const { x, y } = xy(i, p.value),
        part = `${pen ? 'L' : 'M'}${x},${y}`;
      pen = true;
      return part;
    })
    .join(' ');
});
const fmt = (n: number) => new Intl.NumberFormat('es-PY', { maximumFractionDigits: 1 }).format(n);
const tick = (n: number) =>
  new Intl.NumberFormat('es-PY', {
    maximumFractionDigits: 1,
    ...(n >= 10000 ? { notation: 'compact' as const } : {}),
  }).format(n);
</script>
<template>
  <figure ref="figure" class="progress-chart">
    <figcaption :id="id">
      <strong>{{ title }}</strong
      ><span>{{ unit }}</span>
    </figcaption>
    <div v-if="!defined.length" class="progress-chart-empty">
      Todavía no hay valores confirmados en este periodo.
    </div>
    <svg
      v-else
      :viewBox="`0 0 ${width} 225`"
      role="img"
      :aria-labelledby="id"
      :aria-describedby="id + '-description'"
    >
      <title>{{ title }}</title>
      <desc :id="id + '-description'">
        {{ points.length }} fechas. Valores en {{ unit }}. La tabla inferior contiene todos los
        datos. {{ zero ? 'El eje empieza en cero.' : 'Eje adaptado al rango mostrado.' }}
      </desc>
      <g v-for="i in [0, 1, 2]" :key="i">
        <line
          x1="54"
          :y1="33 + i * 72.5"
          :x2="width - 12"
          :y2="33 + i * 72.5"
          class="progress-grid-line"
        />
        <text x="46" :y="37 + i * 72.5" text-anchor="end">
          {{ tick(max - ((max - min) * i) / 2) }}
        </text>
      </g>
      <path :d="path" class="progress-chart-path" />
      <template v-for="(p, i) in points" :key="p.label">
        <circle
          v-if="p.value !== null"
          :cx="xy(i, p.value).x"
          :cy="xy(i, p.value).y"
          r="4.5"
          class="progress-chart-dot"
        >
          <title>{{ p.label }}: {{ fmt(p.value) }} {{ unit }}</title>
        </circle>
      </template>
      <text x="54" y="208">{{ points[0]?.label }}</text>
      <text v-if="points.length > 1" :x="width - 12" y="208" text-anchor="end">
        {{ points.at(-1)?.label }}
      </text></svg
    ><small v-if="defined.length && !zero" class="muted"
      >Eje adaptado al rango; comparar los valores y su unidad.</small
    >
    <details>
      <summary>Ver tabla de {{ title.toLowerCase() }}</summary>
      <div class="progress-table-wrap" role="region" :aria-label="`Tabla de ${title}`" tabindex="0">
        <table>
          <caption>
            {{
              title
            }}
            ·
            {{
              unit
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Valor ({{ unit }})</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in points" :key="p.label">
              <th scope="row">{{ p.label }}</th>
              <td>{{ p.value === null ? 'Sin dato' : fmt(p.value) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </figure>
</template>
