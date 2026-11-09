<script setup lang="ts">
import { confirmAction } from '../action-review';
import { useContextGuard } from '../action-review';
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import { Utensils, Plus, RefreshCw, FileText, ShieldCheck } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import {
  shoppingList,
  type NutritionState,
  type NutritionRow,
  type FoodDocument,
  type RecipeDocument,
  type MenuDraft,
  type MenuSnapshot,
  type NutritionAssignment,
} from '@forma/shared';
import { apiRequest } from '../api';
import { billingDate } from '../billing-date';
import { useStudio, type Student } from '../stores/studio';
import NutritionEditor from './NutritionEditor.vue';
import NutritionDay from './NutritionDay.vue';
import NutritionPrivacy from './NutritionPrivacy.vue';
import '../nutrition.css';
const route = useRoute();
const studio = useStudio();
const props = defineProps<{
    organizationId: string;
    learner: boolean;
    owner: boolean;
  }>(),
  root = `/v1/organizations/${props.organizationId}/nutrition`;
const today = billingDate(new Date().toISOString()),
  date = ref(today),
  requestedStudentId =
    !props.learner && typeof route.query.studentId === 'string' ? route.query.studentId : '',
  studentId = ref(''),
  contextStudent = ref<Student | null>(null),
  studentSearch = ref(''),
  showStudentPicker = ref(false),
  tab = ref('day'),
  data = ref<NutritionState>(),
  busy = ref(false),
  error = ref(''),
  notice = ref(''),
  dirty = ref(false);
const editorKind = ref<'food' | 'recipe' | 'menu'>(),
  editingItem = ref<NutritionRow<FoodDocument | RecipeDocument | MenuDraft>>(),
  query = ref(''),
  visibleCount = ref(24);
const selectedMenu = ref(''),
  versions = ref<
    {
      id: string;
      number: number;
      sourceRevision: number;
      snapshot: MenuSnapshot;
    }[]
  >([]),
  versionId = ref(''),
  startsOn = ref(today),
  endsOn = ref(billingDate(new Date(Date.now() + 6 * 86400000).toISOString()));
const reason = ref(''),
  cancelId = ref('');
let mounted = true,
  loading = 0,
  contextChecked = false;
const blockedStudent = computed(
  () => contextStudent.value !== null && contextStudent.value.accessState !== 'active',
);
const assignment = computed(
  () =>
    data.value?.assignments.find(
      (a) => a.state === 'active' && a.startsOn <= date.value && a.endsOn >= date.value,
    ) ?? data.value?.assignments.find((a) => a.startsOn <= date.value && a.endsOn >= date.value),
);
const selectedVersion = computed(() => versions.value.find((v) => v.id === versionId.value)),
  shopping = computed(() =>
    selectedVersion.value
      ? shoppingList(selectedVersion.value.snapshot)
      : assignment.value
        ? shoppingList(assignment.value.snapshot)
        : [],
  );
const catalogue = computed(() =>
  tab.value === 'foods'
    ? (data.value?.foods ?? [])
    : tab.value === 'recipes'
      ? (data.value?.recipes ?? [])
      : (data.value?.menus ?? []),
);
const filtered = computed(() =>
  catalogue.value
    .filter((i) =>
      i.document.name.toLocaleLowerCase('es').includes(query.value.toLocaleLowerCase('es')),
    )
    .sort((a, b) => a.document.name.localeCompare(b.document.name, 'es')),
);
const visibleItems = computed(() => filtered.value.slice(0, visibleCount.value));
function foodSummary(food: FoodDocument) {
  const { kcal, protein, carbs, fat } = food.nutrients;
  return [
    kcal === null ? '' : `${kcal} kcal`,
    protein === null ? '' : `P ${protein} g`,
    carbs === null ? '' : `C ${carbs} g`,
    fat === null ? '' : `G ${fat} g`,
  ]
    .filter(Boolean)
    .join(' · ');
}
watch([tab, query], () => {
  visibleCount.value = 24;
});
const ownPrivacy = computed(() => data.value?.privacy ?? null);
const windowStart = (d: string) =>
  billingDate(new Date(Date.parse(d + 'T12:00:00Z') - 6 * 86400000).toISOString());
async function allowDiscard() {
  if (!dirty.value) return true;
  if (!(await confirmAction('Hay cambios sin guardar. ¿Descartarlos?'))) return false;
  dirty.value = false;
  return true;
}
async function load() {
  const ticket = ++loading;
  busy.value = true;
  error.value = '';
  try {
    if (requestedStudentId && !contextChecked) {
      const student = await studio.openStudent(requestedStudentId);
      if (!mounted || ticket !== loading) return;
      contextStudent.value = student;
      contextChecked = true;
      if (student.accessState === 'active') studentId.value = student.id;
      else tab.value = 'menus';
    }
    const q = new URLSearchParams({
      from: windowStart(date.value),
      to: date.value,
      q: studentSearch.value,
    });
    if (studentId.value) q.set('studentId', studentId.value);
    const result = await apiRequest<NutritionState>(root + '?' + q);
    if (!mounted || ticket !== loading) return;
    data.value = result;
    if (
      !props.learner &&
      result.professional &&
      !requestedStudentId &&
      !studentId.value &&
      result.students[0]
    ) {
      studentId.value = result.students[0].id;
      await load();
    }
  } catch (e) {
    if (mounted && ticket === loading)
      error.value = e instanceof Error ? e.message : 'No se pudo cargar alimentación.';
  } finally {
    if (ticket === loading) busy.value = false;
  }
}
async function changeTab(next: string) {
  if (!(await allowDiscard())) return;
  editorKind.value = undefined;
  editingItem.value = undefined;
  tab.value = next;
  query.value = '';
}
async function edit(
  kind: 'food' | 'recipe' | 'menu',
  item?: NutritionRow<FoodDocument | RecipeDocument | MenuDraft>,
) {
  if (!(await allowDiscard())) return;
  editingItem.value = item;
  editorKind.value = kind;
}
async function saved() {
  const savedKind = editorKind.value;
  dirty.value = false;
  editorKind.value = undefined;
  editingItem.value = undefined;
  if (savedKind === 'menu') tab.value = 'menus';
  notice.value =
    savedKind === 'menu' ? 'Borrador guardado. Publícalo y asígnalo.' : 'Ficha guardada.';
  await load();
}
function assignmentPeriod(kind: 'day' | 'week' | 'month') {
  const start = new Date(startsOn.value + 'T12:00:00Z');
  if (!Number.isFinite(start.getTime())) return;
  if (kind === 'week') start.setUTCDate(start.getUTCDate() + 6);
  if (kind === 'month') {
    const day = start.getUTCDate();
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() + 1);
    start.setUTCDate(
      Math.min(
        day,
        new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate(),
      ),
    );
    start.setUTCDate(start.getUTCDate() - 1);
  }
  endsOn.value = start.toISOString().slice(0, 10);
}
async function cancelEditor() {
  if (!(await allowDiscard())) return;
  editorKind.value = undefined;
  editingItem.value = undefined;
}
async function searchStudents() {
  if (!(await allowDiscard())) return;
  studentId.value = '';
  await load();
}
async function changeDate(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.value || !(await allowDiscard())) {
    input.value = date.value;
    return;
  }
  date.value = input.value;
  await load();
}
async function changeStudent(event: Event) {
  const input = event.target as HTMLSelectElement;
  if (!(await allowDiscard())) {
    input.value = studentId.value;
    return;
  }
  studentId.value = input.value;
  if (studentId.value) showStudentPicker.value = false;
  await load();
}
async function action(fn: () => Promise<void>) {
  busy.value = true;
  error.value = '';
  try {
    await fn();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo completar la acción.';
  } finally {
    busy.value = false;
  }
}
async function getVersions(id = selectedMenu.value) {
  selectedMenu.value = id;
  await action(async () => {
    versions.value = (
      await apiRequest<{
        versions: typeof versions.value;
      }>(root + '/menus/' + id + '/versions')
    ).versions;
    versionId.value = versions.value[0]?.id ?? '';
  });
}
async function publish(item: NutritionRow<FoodDocument | RecipeDocument | MenuDraft>) {
  await action(async () => {
    const r = await apiRequest<{
      versionId: string;
    }>(root + '/menus/' + item.id + '/publish', {
      method: 'POST',
      body: { revision: item.revision },
    });
    notice.value = 'Versión publicada. Ya puedes asignarla.';
    selectedMenu.value = item.id;
    versions.value = (
      await apiRequest<{
        versions: typeof versions.value;
      }>(root + '/menus/' + item.id + '/versions')
    ).versions;
    versionId.value = r.versionId;
  });
}
let assignmentIntent = { body: '', id: crypto.randomUUID() };
async function assign() {
  await action(async () => {
    const body = {
        versionId: versionId.value,
        studentId: studentId.value,
        startsOn: startsOn.value,
        endsOn: endsOn.value,
      },
      signature = JSON.stringify(body);
    if (assignmentIntent.body !== signature)
      assignmentIntent = { body: signature, id: crypto.randomUUID() };
    await apiRequest(root + '/assignments/' + assignmentIntent.id, { method: 'PUT', body });
    date.value = startsOn.value;
    notice.value = 'Menú asignado. La semana se repite por día de la semana.';
    await load();
  });
}
async function cancelAssignment(a: NutritionAssignment) {
  await action(async () => {
    await apiRequest(root + '/assignments/' + a.id + '/cancel', {
      method: 'POST',
      body: { revision: a.revision, reason: reason.value },
    });
    cancelId.value = '';
    reason.value = '';
    notice.value = 'Asignación cancelada; registros conservados.';
    await load();
  });
}
let pdfIntent = {
  assignment: '',
  resourceRequest: crypto.randomUUID(),
  versionRequest: crypto.randomUUID(),
  resourceId: '',
};
async function preparePdf(a: NutritionAssignment) {
  await action(async () => {
    if (pdfIntent.assignment !== a.id)
      pdfIntent = {
        assignment: a.id,
        resourceRequest: crypto.randomUUID(),
        versionRequest: crypto.randomUUID(),
        resourceId: '',
      };
    const resourceRoot = `/v1/organizations/${props.organizationId}/resources`;
    if (!pdfIntent.resourceId)
      pdfIntent.resourceId = (
        await apiRequest<{
          resource: {
            id: string;
          };
        }>(resourceRoot, {
          method: 'POST',
          body: {
            requestId: pdfIntent.resourceRequest,
            name: ('Menú · ' + a.snapshot.name + ' · ' + a.studentName).slice(0, 100),
            description: 'Menú publicado con marca. Compartir desde Recursos y PDF.',
            collectionId: null,
          },
        })
      ).resource.id;
    await apiRequest(resourceRoot + '/' + pdfIntent.resourceId + '/versions', {
      method: 'POST',
      body: {
        requestId: pdfIntent.versionRequest,
        kind: 'menu',
        studentId: a.studentId,
        assignmentId: a.id,
      },
    });
    notice.value =
      'PDF solicitado. Abre Recursos y PDF para consultar estado y compartirlo con su alumno.';
  });
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = '';
  }
}
onBeforeRouteLeave(async () => await allowDiscard());
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload);
  void load();
});
onBeforeUnmount(() => {
  mounted = false;
  loading++;
  window.removeEventListener('beforeunload', beforeUnload);
});
useContextGuard(allowDiscard);
</script>
<template>
  <section class="nutrition-workspace">
    <header class="page-heading nutrition-heading">
      <div>
        <h1>{{ learner ? 'Mi alimentación' : 'Alimentación' }}</h1>
      </div>
      <UiButton variant="secondary" :disabled="busy || dirty" @click="load"
        ><RefreshCw :size="16" />Actualizar</UiButton
      >
    </header>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="nutrition-note" role="status">
      {{ notice }}
      <RouterLink v-if="notice.startsWith('PDF')" to="/recursos">Abrir recursos</RouterLink>
    </p>
    <div v-if="blockedStudent && contextStudent" class="nutrition-context-note" role="status">
      <span
        >{{ contextStudent.name }} · {{ contextStudent.status }}. Podrás asignar el menú al
        habilitar su acceso.</span
      >
      <RouterLink :to="'/alumnos/' + contextStudent.id">Volver a la ficha</RouterLink>
    </div>
    <nav class="nutrition-tabs" aria-label="Secciones de alimentación">
      <button
        :aria-current="tab === 'day' ? 'page' : undefined"
        :disabled="busy || blockedStudent"
        @click="
          async () => {
            await changeTab('day');
          }
        "
      >
        {{ learner ? 'Mi menú' : 'Seguimiento' }}</button
      ><template v-if="data?.professional"
        ><button
          v-for="t in [
            { id: 'menus', name: 'Menús' },
            { id: 'recipes', name: 'Recetas' },
            { id: 'foods', name: 'Alimentos' },
          ]"
          :key="t.id"
          :aria-current="tab === t.id ? 'page' : undefined"
          :disabled="busy"
          @click="
            async () => {
              await changeTab(t.id);
            }
          "
        >
          {{ t.name }}
        </button></template
      ><button
        v-if="learner"
        :aria-current="tab === 'privacy' ? 'page' : undefined"
        :disabled="busy"
        @click="
          async () => {
            await changeTab('privacy');
          }
        "
      >
        <ShieldCheck :size="15" />Privacidad
      </button>
    </nav>
    <div v-if="!data" class="ui-card nutrition-empty" role="status">
      {{ busy ? 'Cargando tu espacio…' : 'Pulsa Actualizar para cargar alimentación.' }}
    </div>
    <template v-else>
      <NutritionEditor
        v-if="editorKind"
        :key="(editingItem?.id ?? 'new') + editorKind"
        :root="root"
        :kind="editorKind"
        :item="editingItem"
        :foods="data.foods"
        :recipes="data.recipes"
        @dirty="dirty = $event"
        @saved="saved"
        @cancel="cancelEditor"
      />
      <template v-else-if="tab === 'day'">
        <div
          v-if="data.professional && !route.query.studentId && studentId && !showStudentPicker"
          class="nutrition-student-line"
        >
          <strong>{{
            data.students.find((s) => s.id === studentId)?.displayName ?? 'Alumno seleccionado'
          }}</strong>
          <UiButton variant="ghost" :disabled="busy || dirty" @click="showStudentPicker = true"
            >Cambiar</UiButton
          >
        </div>
        <form
          v-if="data.professional && !route.query.studentId && (showStudentPicker || !studentId)"
          class="ui-card nutrition-filters"
          @submit.prevent="searchStudents"
        >
          <label class="field"
            >Buscar alumno<input
              v-model="studentSearch"
              maxlength="100"
              placeholder="Nombre del alumno"
              :disabled="busy || dirty" /></label
          ><UiButton type="submit" variant="secondary" :disabled="busy || dirty">Buscar</UiButton
          ><label class="field"
            >Alumno<select :value="studentId" :disabled="busy" @change="changeStudent">
              <option value="">Selecciona</option>
              <option v-for="s in data.students" :key="s.id" :value="s.id">
                {{ s.displayName }}
              </option>
            </select></label
          ><UiButton
            v-if="studentId"
            variant="ghost"
            :disabled="busy"
            @click="showStudentPicker = false"
            >Cerrar</UiButton
          >
        </form>
        <p
          v-else-if="data.professional && route.query.studentId"
          class="nutrition-selected-student"
        >
          {{ data.students.find((s) => s.id === studentId)?.displayName ?? 'Alumno seleccionado' }}
        </p>
        <UiButton
          v-if="!learner && studentId"
          class="nutrition-create-plan"
          :disabled="busy"
          @click="edit('menu')"
          >Crear plan</UiButton
        >
        <div v-if="!learner && !data.professional" class="ui-card nutrition-empty">
          <h2>Solo el coach propietario puede crear planes.</h2>
        </div>
        <template v-else
          ><label class="field nutrition-date"
            >Día que quieres consultar<input
              :value="date"
              type="date"
              :disabled="busy"
              min="2000-01-01"
              max="2100-01-01"
              @change="changeDate"
          /></label>
          <NutritionDay
            :key="(studentId || data.selfStudentId || 'none') + date"
            :root="root"
            :assignment="assignment"
            :date="date"
            :entries="data.entries"
            :learner="learner"
            :can-read-diary="data.canReadDiary"
            :can-read-photos="data.canReadPhotos"
            :privacy="ownPrivacy"
            :incomplete="data.entriesTruncated || data.assignmentsTruncated"
            @refresh="load"
            @dirty="dirty = $event"
          />
          <p v-if="data.entriesTruncated || data.assignmentsTruncated" class="nutrition-note">
            Hay más registros que los mostrados. Algunos totales pueden estar incompletos.
          </p>
          <p v-if="learner && !ownPrivacy?.diaryConsent" class="nutrition-note">
            Puedes leer el menú sin registrar comidas. Para usar diario o fotos, configura
            <button
              type="button"
              class="nutrition-text-button"
              @click="
                async () => {
                  await changeTab('privacy');
                }
              "
            >
              tus permisos</button
            >.
          </p>
          <details v-if="assignment">
            <summary>Lista de compras · semana prevista</summary>
            <p class="muted">Una semana; revisa las alternativas del menú.</p>
            <ul class="nutrition-list">
              <li v-for="i in shopping" :key="i.id">
                <strong>{{ i.name }} · {{ i.grams }} g</strong><small>{{ i.source }}</small>
              </li>
            </ul>
          </details>
          <div v-if="data.canReadDiary && data.entries.length" class="ui-card nutrition-history">
            <h3>Últimos siete días consultados</h3>
            <p>
              {{ data.entries.filter((e) => e.state === 'eaten').length }} comidas realizadas ·
              {{ data.entries.filter((e) => e.state === 'skipped').length }} omitidas
            </p>
            <div class="nutrition-actions">
              <button
                v-for="d in [...new Set(data.entries.map((e) => e.eatenOn))].reverse()"
                :key="d"
                type="button"
                :disabled="busy"
                @click="changeDate({ target: { value: d } } as unknown as Event)"
              >
                {{ d }}
              </button>
            </div>
          </div>
          <section v-if="data.professional" class="ui-card nutrition-assignments">
            <h3>Asignaciones del periodo consultado</h3>
            <article v-for="a in data.assignments" :key="a.id">
              <strong>{{ a.snapshot.name }} · versión {{ a.number }}</strong>
              <p>
                {{ a.startsOn }} — {{ a.endsOn }} ·
                {{ a.state === 'active' ? 'Activa' : 'Cancelada' }}
              </p>
              <div v-if="a.state === 'active'" class="nutrition-actions">
                <UiButton variant="secondary" :disabled="busy || dirty" @click="preparePdf(a)"
                  ><FileText :size="16" />Preparar PDF privado</UiButton
                ><UiButton variant="secondary" :disabled="busy || dirty" @click="cancelId = a.id"
                  >Cancelar asignación</UiButton
                >
              </div>
              <form
                v-if="cancelId === a.id"
                class="nutrition-inline-form"
                @submit.prevent="cancelAssignment(a)"
              >
                <label class="field"
                  >Motivo de cancelación<input
                    v-model="reason"
                    required
                    minlength="3"
                    maxlength="200"
                /></label>
                <div class="nutrition-actions">
                  <UiButton type="submit" :disabled="busy">Confirmar cancelación</UiButton
                  ><UiButton type="button" variant="secondary" @click="cancelId = ''"
                    >Volver</UiButton
                  >
                </div>
              </form>
            </article>
            <p v-if="!data.assignments.length" class="muted">
              Sin asignaciones en estos siete días.
            </p>
          </section>
        </template>
      </template>
      <NutritionPrivacy
        v-else-if="tab === 'privacy' && ownPrivacy && data.selfStudentId"
        :key="ownPrivacy.revision"
        :root="root"
        :student-id="data.selfStudentId"
        :privacy="ownPrivacy"
        @saved="load"
        @dirty="dirty = $event"
      />
      <section v-else-if="data.professional" class="nutrition-catalog">
        <header class="nutrition-section-heading">
          <h2 class="sr-only">
            {{ tab === 'foods' ? 'Alimentos' : tab === 'recipes' ? 'Recetas' : 'Menús' }}
          </h2>
          <UiButton
            :disabled="busy || (tab === 'recipes' && !data.foods.some((f) => !f.archived))"
            @click="
              async () => {
                await edit(tab === 'foods' ? 'food' : tab === 'recipes' ? 'recipe' : 'menu');
              }
            "
            ><Plus :size="16" />{{
              tab === 'foods' ? 'Nuevo alimento' : tab === 'recipes' ? 'Nueva receta' : 'Nuevo menú'
            }}</UiButton
          >
        </header>
        <label class="field nutrition-search"
          ><span class="sr-only"
            >Buscar
            {{ tab === 'foods' ? 'alimentos' : tab === 'recipes' ? 'recetas' : 'menús' }}</span
          ><input
            v-model="query"
            maxlength="100"
            :placeholder="
              tab === 'foods'
                ? 'Buscar alimentos'
                : tab === 'recipes'
                  ? 'Buscar recetas'
                  : 'Buscar menús'
            "
        /></label>
        <div class="nutrition-card-grid">
          <article
            v-for="item in visibleItems"
            :key="item.id"
            class="ui-card nutrition-catalog-card"
          >
            <span v-if="item.archived" class="eyebrow">Archivado</span>
            <h3>{{ item.document.name }}</h3>
            <p v-if="'source' in item.document && foodSummary(item.document)" class="muted">
              {{ foodSummary(item.document) }} / 100 g
            </p>
            <p v-if="'ingredients' in item.document" class="muted">
              {{ item.document.ingredients.length }} ingredientes ·
              {{ item.document.servings }} porciones
            </p>
            <p v-if="'days' in item.document && item.document.description" class="muted">
              {{ item.document.description }}
            </p>
            <div class="nutrition-actions">
              <UiButton
                variant="secondary"
                :disabled="busy"
                @click="
                  async () => {
                    await edit(
                      tab === 'foods' ? 'food' : tab === 'recipes' ? 'recipe' : 'menu',
                      item,
                    );
                  }
                "
                >Editar</UiButton
              ><template v-if="tab === 'menus' && !item.archived"
                ><UiButton variant="secondary" :disabled="busy" @click="publish(item)"
                  >Publicar</UiButton
                ><UiButton variant="secondary" :disabled="busy" @click="getVersions(item.id)"
                  >Versiones / asignar</UiButton
                ></template
              >
            </div>
          </article>
        </div>
        <UiButton
          v-if="visibleItems.length < filtered.length"
          variant="secondary"
          @click="visibleCount += 24"
          >Mostrar más</UiButton
        >
        <div v-if="!filtered.length" class="ui-card nutrition-empty">
          <Utensils :size="32" />
          <h3>{{ query ? 'No hay coincidencias' : 'Tu catálogo empieza aquí' }}</h3>
          <p>
            {{
              tab === 'foods'
                ? 'Añade alimentos de etiquetas o fuentes verificables. No se importó un catálogo masivo.'
                : tab === 'recipes'
                  ? 'Primero crea un alimento, después combina ingredientes.'
                  : 'Primero crea una receta; después distribuye las comidas de la semana.'
            }}
          </p>
        </div>
        <form
          v-if="tab === 'menus' && selectedMenu"
          class="ui-card nutrition-assignment-form"
          @submit.prevent="assign"
        >
          <h3>Asignar una versión publicada</h3>
          <div class="nutrition-form-grid">
            <label class="field"
              >Versión<select v-model="versionId" required>
                <option value="" disabled>
                  {{ versions.length ? 'Selecciona' : 'Publica primero' }}
                </option>
                <option v-for="v in versions" :key="v.id" :value="v.id">
                  Versión {{ v.number }}
                </option>
              </select></label
            ><label class="field"
              >Alumno<select v-model="studentId" required>
                <option value="" disabled>Selecciona</option>
                <option v-for="s in data.students" :key="s.id" :value="s.id">
                  {{ s.displayName }}
                </option>
              </select></label
            ><label class="field">Desde<input v-model="startsOn" type="date" required /></label
            ><label class="field"
              >Hasta (máximo 84 días)<input v-model="endsOn" type="date" required :min="startsOn"
            /></label>
          </div>
          <div class="nutrition-actions" aria-label="Duración del plan">
            <button type="button" @click="assignmentPeriod('day')">1 día</button>
            <button type="button" @click="assignmentPeriod('week')">1 semana</button>
            <button type="button" @click="assignmentPeriod('month')">1 mes</button>
          </div>
          <p class="nutrition-note">
            La semana se repite por día de la semana. No se permite otro menú activo solapado.
            Editar el catálogo no modifica esta versión.
          </p>
          <UiButton type="submit" :disabled="busy || !versionId || !studentId"
            >Asignar menú</UiButton
          >
          <details v-if="selectedVersion">
            <summary>Vista de la versión y compras</summary>
            <p>{{ selectedVersion.snapshot.name }} · {{ selectedVersion.snapshot.description }}</p>
            <ul>
              <li v-for="d in selectedVersion.snapshot.days" :key="d.weekday">
                Día {{ d.weekday }}:
                {{
                  d.meals
                    .map((m) => m.label + ' · ' + m.recipe.name + ' (' + m.servings + ' porciones)')
                    .join('; ')
                }}
              </li>
            </ul>
            <h4>Compras previstas de una semana</h4>
            <ul>
              <li v-for="i in shopping" :key="i.id">{{ i.name }} · {{ i.grams }} g</li>
            </ul>
          </details>
        </form>
      </section>
    </template>
  </section>
</template>
