<script setup lang="ts">
import { confirmAction } from '../action-review';
import { useContextGuard } from '../action-review';
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import {
  FolderOpen,
  FileText,
  Plus,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  Download,
  Image as ImageIcon,
} from '@lucide/vue';
import { UiButton } from '@forma/ui';
import type {
  PrivateResource,
  ResourceCollection,
  ResourceDetail,
  ResourceCapabilities,
  ResourceKind,
} from '@forma/shared';
import { apiRequest, csrfToken, ApiClientError } from '../api';
import { billingDate } from '../billing-date';
import '../resources.css';
const props = defineProps<{
    organizationId: string;
    learner: boolean;
  }>(),
  root = `/v1/organizations/${props.organizationId}`;
const items = ref<PrivateResource[]>([]),
  collections = ref<ResourceCollection[]>([]),
  next = ref<string | null>(null),
  selected = ref<ResourceDetail>(),
  cap = ref<ResourceCapabilities>(),
  busy = ref(false),
  error = ref(''),
  notice = ref(''),
  q = ref(''),
  folder = ref(''),
  creating = ref(false);
const newName = ref(''),
  newDescription = ref(''),
  newFolder = ref(''),
  editName = ref(''),
  editDescription = ref(''),
  editFolder = ref(''),
  collectionName = ref(''),
  collectionDescription = ref(''),
  collectionStudent = ref(''),
  collectionProgram = ref(''),
  editingCollection = ref<ResourceCollection>();
const kind = ref<ResourceKind>('media'),
  mediaId = ref(''),
  studentId = ref(''),
  assignmentId = ref(''),
  from = ref(billingDate(new Date(Date.now() - 29 * 86400000).toISOString())),
  to = ref(billingDate(new Date().toISOString())),
  file = ref<File>(),
  fileInput = ref<HTMLInputElement>(),
  media = ref<
    {
      id: string;
      kind: string;
      state: string;
    }[]
  >([]),
  shareStudent = ref(''),
  studentSearch = ref('');
type Sources = {
  students: {
    id: string;
    name: string;
  }[];
  moreStudents: boolean;
  programVersions: {
    id: string;
    name: string;
    number: number;
  }[];
  assignments: {
    id: string;
    versionId: string;
    name: string;
    number: number;
    startsOn: string;
  }[];
};
const sources = ref<Sources>({
    students: [],
    moreStudents: false,
    programVersions: [],
    assignments: [],
  }),
  links = ref<
    Record<
      string,
      {
        url: string;
        expiresAt: string;
      }
    >
  >({});
let newId = crypto.randomUUID(),
  versionId = crypto.randomUUID(),
  fingerprint = '',
  fileGeneration = 0,
  disposed = false;
const today = billingDate(new Date().toISOString()),
  canManage = computed(() => !!selected.value?.resource.canManage),
  personal = computed(() => selected.value?.resource.subjectStudentId),
  versionDirty = ref(false);
const metadataDirty = computed(
  () =>
    !!selected.value &&
    (editName.value !== selected.value.resource.name ||
      editDescription.value !== selected.value.resource.description ||
      editFolder.value !== (selected.value.resource.collectionId ?? '')),
);
const dirty = computed(
  () =>
    !!(
      newName.value ||
      newDescription.value ||
      collectionName.value ||
      collectionDescription.value ||
      metadataDirty.value ||
      file.value ||
      versionDirty.value
    ),
);
async function leave() {
  return !dirty.value || (await confirmAction('Hay cambios sin guardar. ¿Descartarlos?'));
}
function unload(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = '';
  }
}
onBeforeRouteLeave(async () => await leave());
onMounted(() => {
  void perform(load);
  window.addEventListener('beforeunload', unload);
});
onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener('beforeunload', unload);
});
async function perform(fn: () => Promise<unknown>) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await fn();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos completar la operación.';
  } finally {
    busy.value = false;
  }
}
async function sourceSearch() {
  const data = await apiRequest<Sources>(
    root +
      '/resource-sources?' +
      new URLSearchParams({
        ...(studentSearch.value ? { q: studentSearch.value } : {}),
        ...(studentId.value ? { studentId: studentId.value } : {}),
      }),
  );
  if (!disposed) sources.value = data;
}
async function load(more = false) {
  const params = new URLSearchParams({
    ...(q.value ? { q: q.value } : {}),
    ...(folder.value ? { collectionId: folder.value } : {}),
    ...(more && next.value ? { before: next.value } : {}),
  });
  const [list, folders] = await Promise.all([
    apiRequest<{
      resources: PrivateResource[];
      nextBefore: string | null;
    }>(root + '/resources?' + params),
    apiRequest<{
      collections: ResourceCollection[];
    }>(root + '/resource-collections'),
  ]);
  if (disposed) return;
  items.value = more ? [...items.value, ...list.resources] : list.resources;
  next.value = list.nextBefore;
  collections.value = folders.collections;
  if (!props.learner) {
    cap.value = await apiRequest<ResourceCapabilities>(root + '/resources/capabilities');
    if (!sources.value.students.length) await sourceSearch();
  }
}
function applyDetail(d: ResourceDetail) {
  selected.value = d;
  editName.value = d.resource.name;
  editDescription.value = d.resource.description;
  editFolder.value = d.resource.collectionId ?? '';
  links.value = {};
  studentId.value = d.resource.subjectStudentId ?? '';
  assignmentId.value = '';
  clearVersion();
}
async function open(id: string) {
  if (!(await leave())) return;
  const data = await apiRequest<ResourceDetail>(root + '/resources/' + id);
  if (!disposed) {
    creating.value = false;
    newName.value = '';
    newDescription.value = '';
    applyDetail(data);
    if (!props.learner) {
      await sourceSearch();
      const result = await apiRequest<{
        media: {
          id: string;
          kind: string;
          state: string;
        }[];
      }>(root + '/media?limit=50');
      media.value = result.media.filter((m) => m.state === 'ready');
    }
  }
}
async function refresh() {
  if (selected.value && !dirty.value) {
    const data = await apiRequest<ResourceDetail>(
      root + '/resources/' + selected.value.resource.id,
    );
    if (!disposed) applyDetail(data);
  }
  await load();
}
function clearVersion() {
  file.value = undefined;
  if (fileInput.value) fileInput.value.value = '';
  mediaId.value = '';
  versionDirty.value = false;
  versionId = crypto.randomUUID();
  fingerprint = '';
}
function picked(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0];
  fileGeneration++;
  versionDirty.value = !!file.value;
}
async function start() {
  if (!(await leave())) return;
  selected.value = undefined;
  creating.value = true;
  newName.value = '';
  newDescription.value = '';
  newFolder.value = folder.value;
  newId = crypto.randomUUID();
  clearVersion();
}
async function create() {
  const data = await apiRequest<ResourceDetail>(root + '/resources', {
    method: 'POST',
    body: {
      requestId: newId,
      name: newName.value,
      description: newDescription.value,
      collectionId: newFolder.value || null,
    },
  });
  newName.value = '';
  newDescription.value = '';
  creating.value = false;
  await load();
  applyDetail(data);
  const result = await apiRequest<{
    media: {
      id: string;
      kind: string;
      state: string;
    }[];
  }>(root + '/media?limit=50');
  media.value = result.media.filter((m) => m.state === 'ready');
  notice.value = 'Recurso creado. Añade su contenido y compártelo cuando esté listo.';
}
async function saveMetadata() {
  if (!selected.value) return;
  const data = await apiRequest<ResourceDetail>(root + '/resources/' + selected.value.resource.id, {
    method: 'PUT',
    body: {
      revision: selected.value.resource.revision,
      name: editName.value,
      description: editDescription.value,
      collectionId: editFolder.value || null,
      archive: false,
    },
  });
  selected.value = data;
  notice.value = 'Datos del recurso guardados.';
  await load();
}
async function archive() {
  if (
    !selected.value ||
    !(await confirmAction(
      'Archivar retira el acceso de todos los alumnos. Los bytes se conservan 30 días antes de depurarse. ¿Continuar?',
    ))
  )
    return;
  await apiRequest(root + '/resources/' + selected.value.resource.id, {
    method: 'PUT',
    body: {
      revision: selected.value.resource.revision,
      name: selected.value.resource.name,
      description: selected.value.resource.description,
      collectionId: selected.value.resource.collectionId,
      archive: true,
    },
  });
  selected.value = undefined;
  clearVersion();
  await load();
  notice.value = 'Recurso archivado. Sus enlaces ya no dan acceso.';
}
async function saveCollection() {
  const body = {
    name: collectionName.value,
    description: collectionDescription.value,
    studentId: collectionStudent.value || null,
    programVersionId: collectionProgram.value || null,
  };
  await apiRequest(
    root +
      '/resource-collections' +
      (editingCollection.value ? '/' + editingCollection.value.id : ''),
    {
      method: editingCollection.value ? 'PUT' : 'POST',
      body: {
        ...body,
        ...(editingCollection.value ? { revision: editingCollection.value.revision } : {}),
      },
    },
  );
  collectionName.value = '';
  collectionDescription.value = '';
  collectionStudent.value = '';
  collectionProgram.value = '';
  editingCollection.value = undefined;
  await load();
  notice.value = 'Colección guardada. Asociar un alumno o programa no comparte su contenido.';
}
function editCollection(c: ResourceCollection) {
  editingCollection.value = c;
  collectionName.value = c.name;
  collectionDescription.value = c.description;
  collectionStudent.value = c.studentId ?? '';
  collectionProgram.value = c.programVersionId ?? '';
}
async function chooseStudent() {
  assignmentId.value = '';
  versionDirty.value = true;
  await sourceSearch();
}
async function addVersion() {
  if (!selected.value) return;
  const r = selected.value.resource;
  if (kind.value === 'upload' && (!file.value || file.value.size > 10485760))
    throw new Error('Elige un PDF de hasta 10 MiB.');
  const body = {
    kind: kind.value,
    ...(kind.value === 'media'
      ? { mediaId: mediaId.value }
      : kind.value === 'upload'
        ? { bytes: file.value!.size }
        : {
            studentId: studentId.value,
            ...(kind.value === 'routine'
              ? { assignmentId: assignmentId.value }
              : { from: from.value, to: to.value }),
          }),
  };
  const signature = JSON.stringify({ ...body, fileGeneration });
  if (signature !== fingerprint) {
    fingerprint = signature;
    versionId = crypto.randomUUID();
  }
  const data = await apiRequest<
    ResourceDetail & {
      versionId: string;
    }
  >(root + '/resources/' + r.id + '/versions', {
    method: 'POST',
    body: { ...body, requestId: versionId },
  });
  if (
    kind.value === 'upload' &&
    data.versions.find((v) => v.id === data.versionId)?.state === 'reserved'
  ) {
    const response = await fetch(root + `/resources/${r.id}/versions/${data.versionId}/content`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/octet-stream', 'X-CSRF-Token': await csrfToken() },
      body: file.value,
      signal: AbortSignal.timeout(60000),
    });
    const result = await response.json();
    if (!response.ok)
      throw new ApiClientError(
        response.status,
        result.code,
        result.message ?? 'No pudimos subir el PDF.',
      );
  }
  const detail = await apiRequest<ResourceDetail>(root + '/resources/' + r.id);
  applyDetail(detail);
  await load();
  notice.value =
    kind.value === 'media'
      ? 'Medio reutilizado sin copiar bytes.'
      : 'Versión solicitada. Usa Actualizar para consultar el resultado; no necesitas mantener esta pantalla abierta.';
}
async function share(grant: boolean, id = shareStudent.value, collection = false) {
  if (!id) throw new Error('Selecciona un alumno.');
  const target = collection ? folder.value : selected.value?.resource.id;
  if (!target) throw new Error('Selecciona un recurso o colección.');
  await apiRequest(
    root + `/${collection ? 'resource-collections' : 'resources'}/${target}/access`,
    { method: 'POST', body: { studentId: id, grant } },
  );
  if (selected.value) {
    const data = await apiRequest<ResourceDetail>(
      root + '/resources/' + selected.value.resource.id,
    );
    selected.value = data;
  }
  notice.value = grant
    ? 'Acceso concedido a los recursos actuales. Los futuros requieren otra acción.'
    : 'Acceso revocado. Una copia ya descargada no puede retirarse del dispositivo.';
}
async function link(version: string) {
  if (!selected.value) return;
  links.value[version] = await apiRequest<{
    url: string;
    expiresAt: string;
  }>(root + `/resources/${selected.value.resource.id}/versions/${version}/link`, {
    method: 'POST',
  });
}
async function retry(id: string) {
  if (!selected.value) return;
  await apiRequest(root + `/resources/${selected.value.resource.id}/versions/${id}/retry`, {
    method: 'POST',
  });
  await refresh();
  notice.value = 'Reintento solicitado para la misma versión y snapshot.';
}
async function cancelVersion(id: string) {
  if (
    !selected.value ||
    !(await confirmAction(
      'Cancelar esta preparación conserva el recurso y su versión disponible. ¿Continuar?',
    ))
  )
    return;
  await apiRequest(root + `/resources/${selected.value.resource.id}/versions/${id}/cancel`, {
    method: 'POST',
  });
  selected.value = await apiRequest<ResourceDetail>(
    root + '/resources/' + selected.value.resource.id,
  );
  await load();
  notice.value =
    'Preparación cancelada. Los archivos ya recibidos conservan su plazo de retención.';
}
const stateLabel = (state: string) =>
  ({
    reserved: 'Esperando archivo',
    pending: 'En cola',
    processing: 'Procesando',
    ready: 'Disponible',
    failed: 'Necesita revisión',
    rejected: 'Rechazado por seguridad',
    purged: 'Bytes retirados',
  })[state] ?? state;
const kindLabel = (value: string) =>
  ({
    media: 'Foto o vídeo',
    upload: 'PDF subido',
    routine: 'PDF de rutina',
    history: 'PDF de historial',
    report: 'Informe PDF',
    menu: 'PDF de alimentación',
  })[value] ?? value;
const errorLabel = (code: string) =>
  ({
    SCANNER_UNAVAILABLE: 'No hay conexión con el servicio de análisis.',
    SCANNER_TIMEOUT: 'El servicio de análisis no respondió a tiempo.',
    DOCUMENT_REJECTED: 'El análisis de seguridad rechazó este archivo.',
    DOCUMENT_PROCESSING_FAILED:
      'La generación no pudo terminar. Revisa el worker y vuelve a intentar.',
    UPLOAD_EXPIRED: 'La reserva de subida venció.',
    DOCUMENT_CANCELLED: 'La preparación fue cancelada. Puedes añadir otra versión.',
    DOCUMENT_STALE: 'El recurso o su autorización cambió.',
    DOCUMENT_TOO_LARGE: 'El PDF supera 10 MiB. Reduce el periodo o programa.',
  })[code] ?? 'No se pudo preparar esta versión. Actualiza o contacta con soporte.';
useContextGuard(leave);
</script>
<template>
  <section class="resource-page" :class="{ 'resource-selected': !!selected }">
    <header class="page-heading">
      <div>
        <span class="date-eyebrow">MATERIAL PARA CADA AVANCE</span>
        <h1>{{ learner ? 'Tus recursos, siempre a mano.' : 'Todo tu material, en un lugar.' }}</h1>
        <p>
          {{
            learner
              ? 'Abre el material que tu coach compartió contigo.'
              : 'Organiza, genera y comparte con claridad. Solo las personas autorizadas pueden abrirlo.'
          }}
        </p>
      </div>
      <FolderOpen :size="32" />
    </header>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="resource-notice" role="status">{{ notice }}</p>
    <p v-if="busy" class="muted" role="status">Preparando tu material…</p>
    <div class="resource-toolbar">
      <UiButton v-if="!learner" :disabled="busy" @click="start"
        ><Plus :size="17" />Nuevo recurso</UiButton
      ><UiButton variant="secondary" :disabled="busy" @click="perform(refresh)"
        ><RefreshCw :size="16" />Actualizar</UiButton
      ><span class="muted"><ShieldCheck :size="15" />Privado · requiere conexión</span>
    </div>
    <details v-if="!learner" class="ui-card collection-editor">
      <summary>Organizar colecciones</summary>
      <form class="resource-form" @submit.prevent="perform(saveCollection)">
        <h2>{{ editingCollection ? 'Editar colección' : 'Nueva colección' }}</h2>
        <label class="field"
          >Nombre de colección<input
            v-model="collectionName"
            required
            minlength="2"
            maxlength="100" /></label
        ><label class="field"
          >Descripción de colección<textarea
            v-model="collectionDescription"
            maxlength="1500"
            rows="2"
          /></label
        ><label class="field"
          >Ficha asociada (opcional)<select v-model="collectionStudent">
            <option value="">Sin ficha</option>
            <option v-for="s in sources.students" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select></label
        ><label class="field"
          >Programa asociado (opcional)<select v-model="collectionProgram">
            <option value="">Sin programa</option>
            <option v-for="p in sources.programVersions" :key="p.id" :value="p.id">
              {{ p.name }} · v{{ p.number }}
            </option>
          </select></label
        >
        <p class="muted">
          Estas asociaciones organizan el material; los permisos se conceden aparte.
        </p>
        <UiButton type="submit" :disabled="busy">Guardar colección</UiButton>
      </form>
      <div class="collection-pills">
        <button
          v-for="c in collections.filter((c) => c.canManage)"
          :key="c.id"
          class="text-link"
          @click="editCollection(c)"
        >
          Editar {{ c.name }}
        </button>
      </div>
    </details>
    <form v-if="creating" class="ui-card resource-form" @submit.prevent="perform(create)">
      <span class="eyebrow">1. CREA EL ESPACIO · 2. AÑADE CONTENIDO · 3. COMPARTE</span>
      <h2>Un nuevo recurso</h2>
      <label class="field"
        >Nombre del recurso<input v-model="newName" minlength="2" maxlength="100" required /></label
      ><label class="field"
        >Descripción del recurso<textarea
          v-model="newDescription"
          maxlength="1500"
          rows="3"
        /></label
      ><label class="field"
        >Colección<select v-model="newFolder">
          <option value="">Sin colección</option>
          <option v-for="c in collections.filter((c) => c.canManage)" :key="c.id" :value="c.id">
            {{ c.name }}
          </option>
        </select></label
      ><UiButton type="submit" :disabled="busy">Crear recurso</UiButton>
    </form>
    <div class="resource-workspace">
      <div class="resource-list">
        <form class="resource-filters" @submit.prevent="perform(() => load())">
          <label class="field"
            >Buscar material<input
              v-model="q"
              type="search"
              maxlength="100"
              placeholder="Nombre o descripción" /></label
          ><label class="field"
            >Colección de recursos<select v-model="folder">
              <option value="">Todo el material</option>
              <option v-for="c in collections" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select></label
          ><UiButton type="submit" variant="secondary" :disabled="busy">Buscar</UiButton>
        </form>
        <div v-if="!items.length && !busy" class="ui-card resource-empty">
          <FolderOpen :size="36" />
          <h2>{{ learner ? 'Tu material llegará aquí.' : 'Un espacio para compartir mejor.' }}</h2>
          <p>
            {{
              learner
                ? 'Aún no hay recursos compartidos que coincidan con tu búsqueda.'
                : 'Crea un recurso, reutiliza una foto o vídeo y añade PDF de entrenamiento.'
            }}
          </p>
        </div>
        <div class="resource-cards">
          <button
            v-for="r in items"
            :key="r.id"
            class="ui-card resource-card"
            :class="{ chosen: r.id === selected?.resource.id }"
            :disabled="busy"
            @click="perform(() => open(r.id))"
          >
            <span class="resource-card-icon"
              ><ImageIcon v-if="r.current?.kind === 'media'" :size="25" /><FileText
                v-else
                :size="25" /></span
            ><span class="resource-card-title">{{ r.name }}</span
            ><span class="resource-card-description">{{
              r.description || 'Material de tu estudio'
            }}</span
            ><span class="resource-card-state">{{
              r.current ? stateLabel(r.current.state) : 'Sin versión disponible'
            }}</span
            ><small
              >{{ r.current ? kindLabel(r.current.kind) : 'Contenido por añadir'
              }}<template v-if="r.current"> · v{{ r.current.number }}</template></small
            >
          </button>
        </div>
        <UiButton
          v-if="next"
          variant="secondary"
          :disabled="busy"
          @click="perform(() => load(true))"
          >Cargar más recursos</UiButton
        >
        <form
          v-if="!learner && folder && collections.find((c) => c.id === folder)?.canManage"
          class="ui-card resource-form"
          @submit.prevent="perform(() => share(true, shareStudent, true))"
        >
          <h2>Compartir esta colección</h2>
          <label class="field"
            >Alumno para colección<select v-model="shareStudent" required>
              <option value="" disabled>Selecciona un alumno</option>
              <option v-for="s in sources.students" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select></label
          >
          <p class="muted">
            Aplica a los recursos actuales. Un PDF personal solo se puede compartir con su alumno.
          </p>
          <UiButton type="submit" :disabled="busy">Compartir colección</UiButton
          ><UiButton
            variant="secondary"
            :disabled="busy"
            @click="perform(() => share(false, shareStudent, true))"
            >Revocar colección</UiButton
          >
        </form>
      </div>
      <section v-if="selected" class="ui-card resource-detail">
        <UiButton
          class="resource-back"
          variant="ghost"
          @click="
            async () => {
              if (await leave()) {
                selected = undefined;
                clearVersion();
              }
            }
          "
          ><ArrowLeft :size="17" />Volver a recursos</UiButton
        ><span class="date-eyebrow">{{
          selected.resource.subjectStudentId ? 'MATERIAL PERSONAL' : 'RECURSO DEL ESTUDIO'
        }}</span>
        <h2>{{ selected.resource.name }}</h2>
        <p class="resource-description">{{ selected.resource.description }}</p>
        <form v-if="canManage" class="resource-form" @submit.prevent="perform(saveMetadata)">
          <details>
            <summary>Nombre, descripción y ubicación</summary>
            <label class="field"
              >Editar nombre<input
                v-model="editName"
                required
                minlength="2"
                maxlength="100" /></label
            ><label class="field"
              >Editar descripción<textarea
                v-model="editDescription"
                maxlength="1500"
                rows="3"
              /></label
            ><label class="field"
              >Mover a colección<select v-model="editFolder">
                <option value="">Sin colección</option>
                <option
                  v-for="c in collections.filter((c) => c.canManage)"
                  :key="c.id"
                  :value="c.id"
                >
                  {{ c.name }}
                </option>
              </select></label
            ><UiButton type="submit" :disabled="busy || !metadataDirty">Guardar datos</UiButton>
          </details>
        </form>
        <div class="resource-versions">
          <h3>Versiones del recurso</h3>
          <p v-if="!selected.versions.length" class="muted">
            Añade el primer contenido para compartirlo.
          </p>
          <article v-for="v in selected.versions" :key="v.id">
            <div>
              <strong>{{ kindLabel(v.kind) }} · v{{ v.number }}</strong
              ><span class="resource-card-state"
                >{{ stateLabel(v.state)
                }}{{ v.id === selected.resource.currentVersionId ? ' · actual' : '' }}</span
              ><small
                >{{ billingDate(v.createdAt)
                }}<template v-if="v.templateVersion"> · plantilla v1</template></small
              >
            </div>
            <p v-if="v.errorCode" class="form-error">{{ errorLabel(v.errorCode) }}</p>
            <UiButton
              v-if="v.state === 'ready'"
              variant="secondary"
              :disabled="busy"
              @click="perform(() => link(v.id))"
              ><Download :size="16" />Preparar acceso privado</UiButton
            >
            <div v-if="links[v.id]" class="resource-links">
              <a :href="links[v.id]!.url" target="_blank" rel="noopener"
                >{{ v.kind === 'upload' ? 'Descargar PDF' : 'Abrir archivo' }} ↗</a
              ><a :href="links[v.id]!.url + '?download=1'" target="_blank" rel="noopener"
                >Descargar copia</a
              ><small>Acceso durante cinco minutos. Después prepara otro enlace.</small>
            </div>
            <UiButton
              v-if="
                canManage &&
                v.state === 'failed' &&
                !['UPLOAD_EXPIRED', 'DOCUMENT_CANCELLED'].includes(v.errorCode ?? '')
              "
              variant="secondary"
              :disabled="busy"
              @click="perform(() => retry(v.id))"
              >Reintentar esta versión</UiButton
            >
            <UiButton
              v-if="canManage && ['reserved', 'pending', 'processing'].includes(v.state)"
              variant="secondary"
              :disabled="busy"
              @click="perform(() => cancelVersion(v.id))"
              >Cancelar preparación</UiButton
            >
          </article>
        </div>
        <form
          v-if="canManage"
          class="resource-form resource-add-version"
          @submit.prevent="perform(addVersion)"
        >
          <h3>Añadir contenido o nueva versión</h3>
          <label class="field"
            >Tipo de contenido<select v-model="kind" @change="versionDirty = true">
              <option value="media">Reutilizar foto o vídeo</option>
              <option value="upload">Subir PDF</option>
              <option value="routine">Generar PDF de rutina</option>
              <option value="history">Generar PDF de historial</option>
              <option value="report">Generar informe PDF</option>
            </select></label
          >
          <template v-if="kind === 'media'"
            ><label class="field"
              >Medio ya preparado<select v-model="mediaId" required @change="versionDirty = true">
                <option value="" disabled>Selecciona un medio disponible</option>
                <option v-for="(m, i) in media" :key="m.id" :value="m.id">
                  {{ m.kind === 'video' ? 'Vídeo' : 'Foto' }} {{ i + 1 }}
                </option>
              </select></label
            >
            <p class="muted">
              Reutiliza los bytes existentes.
              <RouterLink to="/biblioteca">Prepara fotos o clips en Medios</RouterLink>.
            </p></template
          >
          <template v-else-if="kind === 'upload'"
            ><label class="field"
              >Archivo PDF<input
                ref="fileInput"
                type="file"
                accept="application/pdf,.pdf"
                :disabled="!cap?.pdfUploadsConfigured"
                @change="picked"
            /></label>
            <p class="muted">
              Hasta 10 MiB. Solo estará disponible después del análisis; no se aceptan Office ni
              ZIP.
            </p>
            <p v-if="!cap?.pdfUploadsConfigured" class="resource-notice">
              La subida necesita el servicio de análisis del estudio. Puedes generar PDF o
              reutilizar medios.
            </p></template
          >
          <template v-else
            ><label class="field"
              >Alumno del documento<select
                v-model="studentId"
                required
                :disabled="!!personal"
                @change="perform(chooseStudent)"
              >
                <option value="" disabled>Selecciona un alumno</option>
                <option v-for="s in sources.students" :key="s.id" :value="s.id">
                  {{ s.name }}
                </option>
              </select></label
            ><label v-if="kind === 'routine'" class="field"
              >Programa asignado<select
                v-model="assignmentId"
                required
                @change="versionDirty = true"
              >
                <option value="" disabled>Selecciona una asignación activa</option>
                <option v-for="a in sources.assignments" :key="a.id" :value="a.id">
                  {{ a.name }} · v{{ a.number }} · {{ a.startsOn }}
                </option>
              </select></label
            >
            <div v-else class="resource-dates">
              <label class="field"
                >Desde<input
                  v-model="from"
                  type="date"
                  required
                  :max="to"
                  @input="versionDirty = true" /></label
              ><label class="field"
                >Hasta<input
                  v-model="to"
                  type="date"
                  required
                  :min="from"
                  :max="today"
                  @input="versionDirty = true"
              /></label>
            </div>
            <p class="muted">
              Máximo 90 días. Se conserva la marca y los datos al solicitarlo. No incluye medidas,
              fotos corporales ni notas privadas.
            </p>
            <p v-if="!cap?.workerOnline" class="resource-notice">
              El generador no está conectado ahora. La solicitud quedará en cola.
            </p></template
          >
          <UiButton
            type="submit"
            :disabled="busy || (kind === 'upload' && !cap?.pdfUploadsConfigured)"
            >{{
              kind === 'media'
                ? 'Usar medio'
                : kind === 'upload'
                  ? 'Subir y analizar PDF'
                  : 'Solicitar PDF'
            }}</UiButton
          >
        </form>
        <form v-if="canManage" class="resource-form" @submit.prevent="perform(() => share(true))">
          <h3>Compartir con un alumno</h3>
          <label class="field"
            >Buscar alumno<input v-model="studentSearch" maxlength="100" type="search" /></label
          ><UiButton variant="secondary" :disabled="busy" @click="perform(sourceSearch)"
            >Buscar alumno</UiButton
          ><label class="field"
            >Alumno con acceso<select v-model="shareStudent" required>
              <option value="" disabled>Selecciona un alumno</option>
              <option
                v-for="s in sources.students.filter((s) => !personal || s.id === personal)"
                :key="s.id"
                :value="s.id"
              >
                {{ s.name }}
              </option>
            </select></label
          >
          <p v-if="sources.moreStudents" class="muted">
            Hay más alumnos; usa su nombre para encontrarlos.
          </p>
          <UiButton type="submit" :disabled="busy">Conceder acceso</UiButton>
          <ul class="resource-grants">
            <li v-for="g in selected.grants" :key="g.studentId">
              <span>{{ g.studentName }}</span
              ><button
                type="button"
                class="text-link"
                :disabled="busy"
                @click="perform(() => share(false, g.studentId))"
              >
                Revocar acceso
              </button>
            </li>
          </ul>
        </form>
        <p class="muted">
          Revocar impide nuevas aperturas. Una copia descargada queda bajo responsabilidad de quien
          la recibe.
        </p>
        <button
          v-if="canManage"
          class="text-link resource-archive"
          :disabled="busy"
          @click="perform(archive)"
        >
          Archivar y retirar acceso
        </button>
      </section>
    </div>
    <p v-if="!learner && cap" class="resource-usage">
      Espacio del estudio: {{ (cap.usedBytes / 1048576).toFixed(1) }} /
      {{ Math.round(cap.limitBytes / 1048576) }} MiB · PDF solicitados este mes:
      {{ cap.generatedThisMonth }} / {{ cap.monthlyLimit }}. Medios reutilizados no duplican
      almacenamiento.
    </p>
  </section>
</template>
