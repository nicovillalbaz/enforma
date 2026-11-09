<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import {
  Plus,
  ArrowUpRight,
  Layers3,
  Copy,
  CalendarDays,
  Send,
  Archive,
  Trash2,
  RefreshCw,
  Search,
} from '@lucide/vue';
import { UiButton } from '@forma/ui';
import type { TrainingProgram, ProgramVersion, ProgramAssignment } from '@forma/shared';
import { apiRequest } from '../api';
import { useStudio } from '../stores/studio';
import ProgramEditor from './ProgramEditor.vue';
import ProgramReader from './ProgramReader.vue';
import PageStep from './PageStep.vue';
import { useRoutePanel } from '../route-panel';
const studio = useStudio(),
  route = useRoute(),
  organizationId = studio.currentOrganization!.id,
  root = `/v1/organizations/${organizationId}`;
const programs = ref<TrainingProgram[]>([]),
  assignments = ref<ProgramAssignment[]>([]),
  cursor = ref<string | null>(null),
  assignmentCursor = ref<string | null>(null),
  query = ref(''),
  filter = ref('all'),
  tab = ref('programs'),
  busy = ref(false),
  error = ref('');
const editing = ref<{ program: TrainingProgram | null } | null>(null),
  deleting = ref<TrainingProgram | null>(null),
  selected = ref<TrainingProgram | null>(null),
  versions = ref<Omit<ProgramVersion, 'snapshot'>[]>([]),
  versionId = ref(''),
  versionCursor = ref<number | null>(null),
  reader = ref<ProgramVersion | null>(null);
const studentIds = ref<string[]>([]),
  startsOn = ref(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
  ),
  requestId = ref(crypto.randomUUID()),
  cancelling = ref<ProgramAssignment | null>(null),
  reason = ref('');
useRoutePanel(
  'edit',
  editing,
  (value) => value.program?.id ?? 'new',
  async (id) => {
    if (id === 'new') return { program: null };
    if (!/^[a-f0-9-]{36}$/.test(id)) return null;
    return {
      program: (await apiRequest<{ program: TrainingProgram }>(root + '/programs/' + id)).program,
    };
  },
);
useRoutePanel(
  'versions',
  selected,
  (p) => p.id,
  async (id) => {
    if (!/^[a-f0-9-]{36}$/.test(id)) return null;
    const p = (await apiRequest<{ program: TrainingProgram }>(root + '/programs/' + id)).program;
    await openVersions(p);
    return p;
  },
);
useRoutePanel(
  'cancel',
  cancelling,
  (a) => a.id,
  (id) => assignments.value.find((a) => a.id === id) ?? null,
);
const activeStudents = computed(() =>
  studio.students.filter((s) => s.accessState === 'active' && s.userId),
);
watch(
  [() => route.query.studentId, activeStudents],
  ([id, active]) => {
    if (
      typeof id === 'string' &&
      active.some((student) => student.id === id) &&
      !studentIds.value.includes(id)
    )
      studentIds.value = [id];
  },
  { immediate: true },
);
let disposed = false,
  epoch = 0;
let timer: ReturnType<typeof setTimeout>;
async function load(more = false) {
  const current = ++epoch;
  busy.value = true;
  error.value = '';
  try {
    const data = await apiRequest<{ programs: TrainingProgram[]; nextCursor: string | null }>(
      root +
        `/programs?q=${encodeURIComponent(query.value)}&archived=${filter.value === 'archived'}${filter.value === 'templates' ? '&template=true' : ''}${more && cursor.value ? `&cursor=${cursor.value}` : ''}`,
    );
    if (disposed || current !== epoch) return;
    programs.value = more ? [...programs.value, ...data.programs] : data.programs;
    cursor.value = data.nextCursor;
  } catch (e) {
    if (!disposed)
      error.value = e instanceof Error ? e.message : 'No pudimos cargar los programas.';
  } finally {
    if (current === epoch) busy.value = false;
  }
}
async function loadAssignments(more = false) {
  try {
    const data = await apiRequest<{ assignments: ProgramAssignment[]; nextCursor: string | null }>(
      root +
        '/program-assignments' +
        (more && assignmentCursor.value ? `?cursor=${assignmentCursor.value}` : ''),
    );
    if (!disposed) {
      assignments.value = more ? [...assignments.value, ...data.assignments] : data.assignments;
      assignmentCursor.value = data.nextCursor;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos cargar las asignaciones.';
  }
}
watch([query, filter], () => {
  clearTimeout(timer);
  timer = setTimeout(() => load(), 250);
});
watch(tab, () => {
  if (tab.value === 'assignments') loadAssignments();
});
watch(
  [versionId, startsOn, studentIds],
  () => {
    requestId.value = crypto.randomUUID();
  },
  { deep: true },
);
onMounted(() => load());
onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(timer);
});
function saved(p: TrainingProgram) {
  if (editing.value) editing.value = { program: p };
  const index = programs.value.findIndex((x) => x.id === p.id);
  if (index >= 0) programs.value[index] = p;
  else programs.value.unshift(p);
}
async function closeEditor() {
  editing.value = null;
  await load();
}
async function copy(p: TrainingProgram) {
  busy.value = true;
  error.value = '';
  try {
    const data = await apiRequest<{ program: TrainingProgram }>(root + `/programs/${p.id}/copy`, {
      method: 'POST',
      body: { versionId: null },
    });
    saved(data.program);
    editing.value = { program: data.program };
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos copiar.';
  } finally {
    busy.value = false;
  }
}
async function archive(p: TrainingProgram) {
  busy.value = true;
  error.value = '';
  try {
    await apiRequest(root + `/programs/${p.id}/archive`, {
      method: 'POST',
      body: { revision: p.revision, archived: !p.archived },
    });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos cambiar su estado.';
  } finally {
    busy.value = false;
  }
}
async function deleteDraft(p: TrainingProgram) {
  busy.value = true;
  error.value = '';
  try {
    await apiRequest(root + `/programs/${p.id}/delete`, {
      method: 'POST',
      body: { revision: p.revision },
    });
    deleting.value = null;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos eliminar el borrador.';
  } finally {
    busy.value = false;
  }
}
async function openVersions(p: TrainingProgram) {
  busy.value = true;
  error.value = '';
  try {
    const result = await apiRequest<{
      versions: Omit<ProgramVersion, 'snapshot'>[];
      nextNumber: number | null;
    }>(root + `/programs/${p.id}/versions`);
    versions.value = result.versions;
    versionCursor.value = result.nextNumber;
    selected.value = p;
    versionId.value = versions.value[0]?.id ?? '';
    studentIds.value = [];
    await studio.refreshStudents();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos abrir las versiones.';
  } finally {
    busy.value = false;
  }
}
async function readVersion() {
  if (!versionId.value) return;
  busy.value = true;
  error.value = '';
  try {
    reader.value = (
      await apiRequest<{ version: ProgramVersion }>(root + '/program-versions/' + versionId.value)
    ).version;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos leer la versión.';
  } finally {
    busy.value = false;
  }
}
async function moreVersions() {
  if (!selected.value || versionCursor.value === null) return;
  try {
    const result = await apiRequest<{
      versions: Omit<ProgramVersion, 'snapshot'>[];
      nextNumber: number | null;
    }>(root + `/programs/${selected.value.id}/versions?beforeNumber=${versionCursor.value}`);
    versions.value.push(...result.versions);
    versionCursor.value = result.nextNumber;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos cargar las versiones anteriores.';
  }
}
async function copyVersion() {
  if (!selected.value || !versionId.value) return;
  busy.value = true;
  try {
    const data = await apiRequest<{ program: TrainingProgram }>(
      root + `/programs/${selected.value.id}/copy`,
      { method: 'POST', body: { versionId: versionId.value } },
    );
    selected.value = null;
    reader.value = null;
    editing.value = { program: data.program };
    saved(data.program);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos copiar esta versión.';
  } finally {
    busy.value = false;
  }
}
async function assign() {
  busy.value = true;
  error.value = '';
  try {
    const result = await apiRequest<{ assignments: ProgramAssignment[] }>(
      root + `/program-versions/${versionId.value}/assignments`,
      {
        method: 'POST',
        body: {
          studentIds: studentIds.value,
          startsOn: startsOn.value,
          requestId: requestId.value,
        },
      },
    );
    studio.notify(`Versión asignada a ${result.assignments.length} alumno(s).`);
    selected.value = null;
    reader.value = null;
    tab.value = 'assignments';
    await loadAssignments();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos asignar el programa.';
  } finally {
    busy.value = false;
  }
}
async function openCancel(a: ProgramAssignment) {
  cancelling.value = a;
  reason.value = '';
}
async function cancel() {
  if (!cancelling.value) return;
  busy.value = true;
  error.value = '';
  try {
    await apiRequest(root + `/program-assignments/${cancelling.value.id}/cancel`, {
      method: 'POST',
      body: { revision: cancelling.value.revision, reason: reason.value },
    });
    cancelling.value = null;
    await loadAssignments();
    studio.notify('Asignación cancelada. Las nuevas consultas del alumno pierden ese acceso.');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos cancelar.';
  } finally {
    busy.value = false;
  }
}
function weeks(p: TrainingProgram) {
  return p.document.weeks.length;
}
</script>
<template>
  <ProgramEditor
    v-if="editing"
    :organization-id="organizationId"
    :program="editing.program"
    @close="closeEditor"
    @saved="saved"
    @published="load()"
  />
  <div v-else class="programs-page">
    <div v-show="!selected && !cancelling">
      <div class="page-heading">
        <div>
          <h1>Rutinas</h1>
        </div>
        <UiButton @click="editing = { program: null }"><Plus :size="17" />Nuevo programa</UiButton>
      </div>
      <nav class="library-tabs" aria-label="Secciones de rutinas">
        <button :class="{ active: tab === 'programs' }" @click="tab = 'programs'">
          <Layers3 :size="17" />Programas</button
        ><button :class="{ active: tab === 'assignments' }" @click="tab = 'assignments'">
          <CalendarDays :size="17" />Asignaciones
        </button>
      </nav>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <template v-if="tab === 'programs'"
        ><div class="program-list-filters">
          <label class="search-field"
            ><Search :size="18" /><input
              v-model="query"
              type="search"
              aria-label="Buscar programa"
              placeholder="Buscar rutina" /></label
          ><label class="field"
            >Mostrar<select v-model="filter" aria-label="Filtrar programas">
              <option value="all">Todos los programas</option>
              <option value="templates">Plantillas</option>
              <option value="archived">Archivados</option>
            </select></label
          >
        </div>
        <p v-if="busy" role="status" class="muted">Actualizando…</p>
        <div class="program-card-grid">
          <article v-for="p in programs" :key="p.id" class="ui-card program-card">
            <div class="program-card-body">
              <div class="program-card-heading">
                <h2>{{ p.document.name }}</h2>
                <span class="status-badge">{{
                  p.archived
                    ? 'Archivado'
                    : p.latestPublishedRevision === p.revision
                      ? 'Publicado'
                      : p.publishedCount
                        ? 'Cambios en borrador'
                        : 'Borrador'
                }}</span>
              </div>
              <p class="program-card-meta">
                {{ weeks(p) }} {{ weeks(p) === 1 ? 'semana' : 'semanas'
                }}{{ p.document.isTemplate ? ' · Plantilla' : '' }}
              </p>
              <p v-if="p.document.description" class="library-excerpt">
                {{ p.document.description }}
              </p>
              <div class="program-card-actions">
                <UiButton v-if="!p.archived" variant="secondary" @click="editing = { program: p }"
                  >Editar <ArrowUpRight :size="16" /></UiButton
                ><UiButton variant="ghost" @click="openVersions(p)">Versiones y asignar</UiButton
                ><UiButton variant="ghost" :disabled="busy" @click="copy(p)"
                  ><Copy :size="16" />Duplicar</UiButton
                ><UiButton variant="ghost" :disabled="busy" @click="archive(p)"
                  ><Archive :size="16" />{{ p.archived ? 'Restaurar' : 'Archivar' }}</UiButton
                >
                <UiButton
                  v-if="p.publishedCount === 0 && studio.currentOrganization?.role === 'owner'"
                  variant="ghost"
                  :disabled="busy"
                  @click="deleting = p"
                  ><Trash2 :size="16" />Eliminar</UiButton
                >
              </div>
              <div v-if="deleting?.id === p.id" class="program-delete-review">
                <p>Eliminar este borrador sin publicar. Esta acción no se puede deshacer.</p>
                <UiButton :disabled="busy" @click="deleteDraft(p)">Eliminar borrador</UiButton>
                <UiButton variant="secondary" :disabled="busy" @click="deleting = null"
                  >Volver</UiButton
                >
              </div>
            </div>
          </article>
        </div>
        <div v-if="!busy && !programs.length" class="empty-state">
          <Layers3 :size="38" />
          <h2>Sin rutinas</h2>
          <p>Crea una rutina o cambia el filtro.</p>
        </div>
        <UiButton v-if="cursor" variant="secondary" @click="load(true)"
          >Cargar más programas</UiButton
        ></template
      >
      <template v-else
        ><UiButton variant="ghost" @click="loadAssignments()"
          ><RefreshCw :size="16" />Actualizar asignaciones</UiButton
        >
        <div class="program-assignment-grid">
          <article v-for="a in assignments" :key="a.id" class="ui-card program-assignment">
            <span class="eyebrow"
              >{{ a.state === 'cancelled' ? 'CANCELADO' : 'PLANIFICADO' }} · V{{
                a.versionNumber
              }}</span
            >
            <h2>{{ a.programName }}</h2>
            <strong>{{ a.studentName }}</strong>
            <p>{{ a.startsOn }} → {{ a.endsOn }}</p>
            <p v-if="a.cancellationReason" class="muted">{{ a.cancellationReason }}</p>
            <UiButton v-if="a.state === 'active'" variant="secondary" @click="openCancel(a)"
              >Cancelar asignación</UiButton
            >
          </article>
        </div>
        <p v-if="!assignments.length" class="empty-state">
          Publica un programa y asigna su versión a tus alumnos activos.
        </p>
        <UiButton v-if="assignmentCursor" variant="secondary" @click="loadAssignments(true)"
          >Cargar más asignaciones</UiButton
        ></template
      >
    </div>
    <PageStep
      v-if="selected"
      back-label="Programas"
      @back="
        selected = null;
        reader = null;
      "
    >
      <h2>{{ selected.document.name }}</h2>
      <p class="muted">
        Cada publicación guarda una versión fija. Asignar otra versión no cambia programas
        anteriores.
      </p>
      <p v-if="!versions.length" class="empty-state">
        Guarda y publica su primera versión desde el constructor.
      </p>
      <template v-else
        ><label class="field"
          >Versión publicada<select v-model="versionId" @change="reader = null">
            <option v-for="v in versions" :key="v.id" :value="v.id">Versión {{ v.number }}</option>
          </select></label
        ><UiButton
          v-if="versionCursor !== null"
          variant="ghost"
          :disabled="busy"
          @click="moreVersions"
          >Cargar versiones anteriores</UiButton
        ><UiButton variant="secondary" :disabled="busy" @click="readVersion"
          >Consultar versión</UiButton
        ><UiButton variant="ghost" :disabled="busy" @click="copyVersion"
          >Usar versión como borrador</UiButton
        ><ProgramReader
          v-if="reader"
          :key="reader.id"
          :document="reader.snapshot"
          :organization-id="organizationId"
          :version-number="reader.number"
        />
        <form class="program-assign-form" @submit.prevent="assign">
          <h3>Asignar a alumnos</h3>
          <label class="field"
            >Fecha de inicio<input v-model="startsOn" type="date" required
          /></label>
          <p class="muted small-text">
            Día 1 del ciclo es la fecha elegida; cada semana conserva siete días. No se permiten
            periodos solapados para el mismo alumno.
          </p>
          <fieldset class="program-student-picker">
            <legend>Alumnos activos</legend>
            <label v-for="s in activeStudents" :key="s.id"
              ><input v-model="studentIds" type="checkbox" :value="s.id" /><span
                >{{ s.name }}<small>{{ s.email }}</small></span
              ></label
            >
            <p v-if="!activeStudents.length">
              No hay alumnos activos en esta página. Revisa las fichas o carga más.
            </p>
          </fieldset>
          <UiButton v-if="studio.nextCursor" variant="secondary" @click="studio.loadMoreStudents()"
            >Cargar más alumnos</UiButton
          ><UiButton type="submit" :disabled="busy || !studentIds.length || studentIds.length > 100"
            ><Send :size="16" />Asignar versión a {{ studentIds.length }} alumno(s)</UiButton
          >
        </form></template
      >
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </PageStep>
    <PageStep
      v-if="cancelling"
      title="Cancelar asignación"
      back-label="Asignaciones"
      @back="cancelling = null"
    >
      <p>{{ cancelling.studentName }} · {{ cancelling.programName }}</p>
      <form @submit.prevent="cancel">
        <label class="field"
          >Motivo de cancelación<textarea v-model="reason" minlength="3" maxlength="200" required />
        </label>
        <p class="program-notice">
          El historial se conserva. Se retira el acceso del alumno a esta asignación.
        </p>
        <UiButton type="submit" :disabled="busy">Confirmar cancelación</UiButton>
      </form>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </PageStep>
  </div>
</template>
