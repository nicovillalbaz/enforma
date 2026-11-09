<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronLeft, ChevronRight, Play, CalendarDays, Dumbbell } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import {
  dateAt,
  type ProgramDocument,
  type ProgramEntry,
  type LibraryExercise,
} from '@forma/shared';
import LibraryPreview from './LibraryPreview.vue';
import { useRoutePanel } from '../route-panel';
const props = defineProps<{
  document: ProgramDocument;
  organizationId: string;
  startsOn?: string;
  versionNumber?: number;
  preview?: boolean;
  assignmentId?: string;
}>();
const weekIndex = ref(0),
  dayIndex = ref(0),
  guide = ref<LibraryExercise | null>(null);
const week = computed(() => props.document.weeks[weekIndex.value]);
const day = computed(() => week.value?.days[dayIndex.value]);
function openGuide(x: ProgramEntry) {
  const s = x.snapshot;
  if (!s) return;
  guide.value = {
    id: x.id,
    ...s,
    media: s.media ?? null,
    equipmentId: null,
    equipmentName: s.equipment?.name ?? null,
    state: 'published',
    version: 1,
    global: false,
    createdAt: '',
    mediaId: s.mediaId,
  };
}
function formatted(value: string) {
  return new Intl.DateTimeFormat('es-PY', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(value + 'T12:00:00Z'));
}
useRoutePanel(
  'movement',
  guide,
  (x) => x.id,
  (id) => {
    const x = props.document.weeks
      .flatMap((w) => w.days.flatMap((d) => d.exercises))
      .find((x) => x.id === id);
    if (x) openGuide(x);
    return guide.value;
  },
);
</script>
<template>
  <section class="program-reader">
    <div v-show="!guide">
      <div class="program-reader-heading">
        <span class="eyebrow">{{
          preview ? 'VISTA PREVIA DEL BORRADOR' : `VERSIÓN ${versionNumber ?? 1} · PLANIFICADO`
        }}</span>
        <h2>{{ document.name }}</h2>
        <p class="muted">{{ document.description }}</p>
        <p v-if="preview" class="program-notice">
          Esta vista usa la biblioteca actual. Publicar guardará una versión fija para tus alumnos.
        </p>
      </div>
      <div class="program-week-switch">
        <UiButton
          variant="secondary"
          :disabled="weekIndex === 0"
          aria-label="Semana anterior"
          @click="
            weekIndex--;
            dayIndex = 0;
          "
          ><ChevronLeft :size="18" /></UiButton
        ><label class="field"
          >Semana<select
            v-model.number="weekIndex"
            aria-label="Semana del programa"
            @change="dayIndex = 0"
          >
            <option v-for="(w, i) in document.weeks" :key="w.id" :value="i">
              {{ i + 1 }} · {{ w.name }}
            </option>
          </select></label
        ><UiButton
          variant="secondary"
          :disabled="weekIndex === document.weeks.length - 1"
          aria-label="Semana siguiente"
          @click="
            weekIndex++;
            dayIndex = 0;
          "
          ><ChevronRight :size="18"
        /></UiButton>
      </div>
      <nav class="program-day-tabs" aria-label="Días del programa">
        <button
          v-for="(d, i) in week?.days"
          :key="d.id"
          :class="{ active: i === dayIndex }"
          @click="dayIndex = i"
        >
          <span>Día {{ d.weekday }}</span
          ><strong>{{ d.name }}</strong
          ><small v-if="startsOn">{{
            formatted(dateAt(startsOn, weekIndex * 7 + d.weekday - 1))
          }}</small>
        </button>
      </nav>
      <p v-if="day?.notes" class="program-day-note"><CalendarDays :size="18" />{{ day.notes }}</p>
      <div class="program-reading-grid">
        <article v-for="(x, i) in day?.exercises" :key="x.id" class="ui-card program-prescription">
          <header>
            <span class="program-order">{{ String(i + 1).padStart(2, '0') }}</span>
            <div>
              <span class="eyebrow">{{ x.snapshot?.muscle }}</span>
              <h3>{{ x.snapshot?.name ?? 'Ejercicio' }}</h3>
              <p class="muted small-text">
                {{ x.snapshot?.equipment?.name || x.snapshot?.equipmentTag || 'Sin material'
                }}<span v-if="x.snapshot?.equipment?.location">
                  · {{ x.snapshot.equipment.location }}</span
                >
              </p>
            </div>
          </header>
          <p class="program-instructions">{{ x.snapshot?.instructions }}</p>
          <UiButton variant="secondary" @click="openGuide(x)"
            ><Play :size="16" />{{ x.snapshot?.media ? 'Ver medio y guía' : 'Ver guía' }}</UiButton
          >
          <p v-if="x.notes" class="program-day-note">{{ x.notes }}</p>
          <h4>Series objetivo</h4>
          <ol class="program-targets">
            <li v-for="(s, j) in x.sets" :key="s.id">
              <span class="program-set-index">{{ j + 1 }}</span>
              <div>
                <strong v-if="x.snapshot?.metric === 'time'">{{ s.seconds }} s</strong
                ><strong v-else-if="x.snapshot?.metric === 'distance'"
                  >{{ s.distanceMeters }} m</strong
                ><strong v-else
                  >{{ s.repsMin }}{{ s.repsMax !== s.repsMin ? `–${s.repsMax}` : '' }} rep</strong
                ><span v-if="s.weightKg !== null"> · {{ s.weightKg }} kg</span
                ><span v-else> · carga indicada por tu coach</span
                ><small
                  >Descanso {{ s.restSeconds }} s<span v-if="s.rpe !== null">
                    · Esfuerzo {{ s.rpe }}/10</span
                  ></small
                >
              </div>
            </li>
          </ol>
        </article>
      </div>
      <p v-if="!day" class="empty-state">Esta semana todavía no tiene días.</p>
      <RouterLink
        v-if="assignmentId && day?.exercises.length && week"
        class="hero-button"
        :to="{ path: '/entrenar', query: { assignmentId, weekId: week.id, dayId: day.id } }"
        >Preparar este entrenamiento <Dumbbell :size="17"
      /></RouterLink>
      <p class="program-notice">
        <Dumbbell :size="17" />Prescripciones de tu coach. Los valores realizados se registran en
        Entrenar.
      </p>
    </div>
  </section>
  <LibraryPreview
    v-if="guide"
    :organization-id="organizationId"
    :exercise="guide"
    :staff="false"
    @close="guide = null"
  />
</template>
