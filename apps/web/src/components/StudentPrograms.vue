<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { ArrowRight, CalendarDays, ArrowLeft } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import type { ProgramAssignment, ProgramVersion } from '@forma/shared';
import { apiRequest } from '../api';
import { useStudio } from '../stores/studio';
import ProgramReader from './ProgramReader.vue';
defineProps<{ embedded?: boolean }>();
const studio = useStudio(),
  organizationId = studio.currentOrganization!.id,
  root = `/v1/organizations/${organizationId}`;
const assignments = ref<ProgramAssignment[]>([]),
  cursor = ref<string | null>(null),
  selected = ref<ProgramAssignment | null>(null),
  version = ref<ProgramVersion | null>(null),
  error = ref(''),
  busy = ref(false);
let disposed = false;
const displayDate = (value: string) =>
  new Intl.DateTimeFormat('es-PY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value + 'T12:00:00Z'));
async function load(more = false) {
  busy.value = true;
  error.value = '';
  try {
    const data = await apiRequest<{ assignments: ProgramAssignment[]; nextCursor: string | null }>(
      root +
        '/program-assignments?state=active' +
        (more && cursor.value ? '&cursor=' + cursor.value : ''),
    );
    if (!disposed) {
      assignments.value = more ? [...assignments.value, ...data.assignments] : data.assignments;
      cursor.value = data.nextCursor;
    }
  } catch (e) {
    if (!disposed)
      error.value = e instanceof Error ? e.message : 'No pudimos consultar tu programa.';
  } finally {
    busy.value = false;
  }
}
async function open(a: ProgramAssignment) {
  busy.value = true;
  error.value = '';
  try {
    const data = await apiRequest<{ version: ProgramVersion }>(
      root + '/program-versions/' + a.versionId,
    );
    if (!disposed) {
      selected.value = a;
      version.value = data.version;
    }
  } catch (e) {
    version.value = null;
    selected.value = null;
    const message = e instanceof Error ? e.message : 'No pudimos abrir el programa.';
    await load();
    error.value = message;
  } finally {
    busy.value = false;
  }
}
onMounted(() => load());
onBeforeUnmount(() => {
  disposed = true;
});
</script>
<template>
  <section class="student-programs">
    <template v-if="!embedded"><h1>Mi programa</h1></template>
    <h2 v-else class="student-program-title">Tu programa</h2>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="busy" role="status">Consultando tu programa…</p>
    <template v-if="selected && version && !embedded"
      ><UiButton
        variant="ghost"
        @click="
          selected = null;
          version = null;
        "
        ><ArrowLeft :size="17" />Mis programas</UiButton
      >
      <p class="program-date-range">
        <CalendarDays :size="17" />{{ displayDate(selected.startsOn) }} →
        {{ displayDate(selected.endsOn) }}
      </p>
      <ProgramReader
        :key="selected.id"
        :document="version.snapshot"
        :organization-id="organizationId"
        :starts-on="selected.startsOn"
        :version-number="version.number"
        :assignment-id="selected.id"
    /></template>
    <template v-else
      ><div class="program-assignment-grid">
        <article
          v-for="a in embedded ? assignments.slice(0, 1) : assignments"
          :key="a.id"
          class="ui-card student-program-card"
        >
          <span class="eyebrow">Versión {{ a.versionNumber }}</span>
          <h2>{{ a.programName }}</h2>
          <p>{{ displayDate(a.startsOn) }} → {{ displayDate(a.endsOn) }}</p>
          <RouterLink v-if="embedded" to="/mi-programa" class="hero-button"
            >Ver mi programa <ArrowRight :size="18" /></RouterLink
          ><UiButton v-else @click="open(a)">Consultar programa <ArrowRight :size="17" /></UiButton>
        </article>
      </div>
      <div v-if="!busy && !assignments.length" class="ui-card empty-state">
        <CalendarDays :size="34" />
        <h2>Sin rutina asignada</h2>
        <UiButton v-if="!embedded" variant="secondary" @click="load()">Actualizar</UiButton>
      </div>
      <UiButton v-if="cursor && !embedded" variant="secondary" @click="load(true)"
        >Cargar más programas</UiButton
      ></template
    >
  </section>
</template>
