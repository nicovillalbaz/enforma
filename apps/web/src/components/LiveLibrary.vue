<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Plus,
  Search,
  Dumbbell,
  Play,
  Image as ImageIcon,
  ImageOff,
  ArrowUpRight,
  SlidersHorizontal,
  Package,
  Film,
  RefreshCw,
  Trash2,
  Clock3,
} from '@lucide/vue';
import { UiButton, UiCard } from '@forma/ui';
import type { LibraryExercise, StudioEquipment, MediaAsset, MediaUsage } from '@forma/shared';
import { apiRequest } from '../api';
import { useStudio } from '../stores/studio';
import LibraryEditor from './LibraryEditor.vue';
import { useRoutePanel } from '../route-panel';
import { coachOptions, loadCoachOptions } from '../coach-options';
import LibraryPreview from './LibraryPreview.vue';
import ExerciseSymbol from './ExerciseSymbol.vue';
import {
  exerciseArtwork,
  exerciseEquipmentCategory,
  exerciseEquipmentLabel,
} from '../exercise-artwork';
import MediaUploader from './MediaUploader.vue';
const studio = useStudio();
const route = useRoute(),
  router = useRouter();
async function editPreview() {
  const exercise = preview.value?.exercise;
  if (!exercise) return;
  await router.push({
    query: {
      ...route.query,
      guide: undefined,
      edit: 'exercise:' + exercise.id + (exercise.global ? ':copy' : ''),
    },
  });
}
const organizationId = studio.currentOrganization!.id;
const staff = computed(() => studio.currentOrganization?.role !== 'student');
const tab = ref<'exercises' | 'equipment' | 'media'>('exercises');
const exercises = ref<LibraryExercise[]>([]);
const equipment = ref<StudioEquipment[]>([]);
const assets = ref<MediaAsset[]>([]);
const usage = ref<MediaUsage | null>(null);
const search = ref('');
const origin = ref('all');
const muscle = ref('');
const state = ref('all');
const busy = ref(false);
const error = ref('');
const nextCursor = ref<string | null>(null);
const equipmentCursor = ref<string | null>(null);
const mediaCursor = ref<string | null>(null);
const editor = ref<{
  kind: 'exercise' | 'equipment';
  exercise?: LibraryExercise;
  equipment?: StudioEquipment;
  clone?: boolean;
} | null>(null);
const preview = ref<{ exercise?: LibraryExercise; media?: MediaAsset } | null>(null);
const savedOptions = coachOptions(organizationId);
const availableMuscles = ref<string[]>([]);
const muscleOptions = computed(() =>
  [
    ...new Set([
      ...savedOptions.value.filter((o) => o.field === 'exercise_group').map((o) => o.value),
      ...availableMuscles.value,
      ...exercises.value.map((e) => e.muscle),
    ]),
  ].sort(),
);
if (studio.currentOrganization?.role === 'owner')
  void loadCoachOptions(organizationId).catch(() => {});
useRoutePanel(
  'edit',
  editor,
  (value) =>
    value.kind +
    ':' +
    (value.exercise?.id ?? value.equipment?.id ?? 'new') +
    (value.clone ? ':copy' : ''),
  async (value): Promise<NonNullable<typeof editor.value> | null> => {
    const [kind, id, mode] = value.split(':');
    if (kind !== 'exercise' && kind !== 'equipment') return null;
    if (id === 'new') return { kind };
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) return null;
    if (kind === 'exercise')
      return {
        kind,
        exercise: (
          await apiRequest<{ exercise: LibraryExercise }>(
            `/v1/organizations/${organizationId}/exercises/${id}`,
          )
        ).exercise,
        clone: mode === 'copy',
      };
    return {
      kind,
      equipment:
        equipment.value.find((e) => e.id === id) ??
        (
          await apiRequest<{ equipment: StudioEquipment }>(
            `/v1/organizations/${organizationId}/equipment/${id}`,
          )
        ).equipment,
    };
  },
);
useRoutePanel(
  'guide',
  preview,
  (value) => (value.exercise ? 'exercise:' + value.exercise.id : 'media:' + value.media!.id),
  async (value) => {
    const [kind, id] = value.split(':');
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) return null;
    if (kind === 'exercise')
      return {
        exercise: (
          await apiRequest<{ exercise: LibraryExercise }>(
            `/v1/organizations/${organizationId}/exercises/${id}`,
          )
        ).exercise,
      };
    return {
      media: (
        await apiRequest<{ media: MediaAsset }>(`/v1/organizations/${organizationId}/media/${id}`)
      ).media,
    };
  },
);
let disposed = false;
let epoch = 0;
let searchTimer: ReturnType<typeof setTimeout>;
let poll: ReturnType<typeof setInterval>;
const states: Record<MediaAsset['state'], string> = {
  reserved: 'Carga preparada',
  uploading: 'Subiendo',
  pending: 'En cola',
  processing: 'Procesando',
  ready: 'Listo',
  failed: 'No se pudo procesar',
  cancelled: 'Cancelado',
  deleted: 'Eliminado',
};
const mediaErrors: Record<string, string> = {
  MEDIA_CORRUPT: 'El archivo no se pudo leer. Prueba otro archivo.',
  MEDIA_FORMAT: 'Usa una imagen PNG/JPG/WebP/GIF o un clip MP4/MOV/WebM.',
  MEDIA_DURATION: 'El clip debe durar entre 1 y 60 segundos.',
  MEDIA_DIMENSIONS: 'La resolución del archivo supera el límite.',
  MEDIA_TIMEOUT: 'La conversión agotó su tiempo. Puedes reintentar.',
  MEDIA_ENGINE_UNAVAILABLE: 'El procesador de medios no está disponible.',
  MEDIA_INPUT_CHANGED: 'El archivo cambió. Prepara una carga nueva.',
};
const formatBytes = (bytes: number) =>
  `${(bytes / 1024 / 1024).toLocaleString('es-PY', { maximumFractionDigits: 1 })} MB`;
const equipmentVisible = computed(() =>
  equipment.value.filter((q) =>
    `${q.name} ${q.description} ${q.location}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
);
async function load(more = false) {
  const current = ++epoch;
  busy.value = true;
  error.value = '';
  try {
    const query = new URLSearchParams({
      q: search.value,
      muscle: muscle.value,
      origin: origin.value,
      state: state.value,
      limit: '60',
    });
    if (more && nextCursor.value) query.set('cursor', nextCursor.value);
    const data = await apiRequest<{ exercises: LibraryExercise[]; nextCursor: string | null }>(
      `/v1/organizations/${organizationId}/exercises?${query}`,
    );
    if (disposed || current !== epoch) return;
    exercises.value = more ? [...exercises.value, ...data.exercises] : data.exercises;
    if (!more && !search.value && !muscle.value && origin.value === 'all')
      availableMuscles.value = [...new Set(data.exercises.map((item) => item.muscle))];
    nextCursor.value = data.nextCursor;
  } catch (e) {
    if (current === epoch)
      error.value = e instanceof Error ? e.message : 'No pudimos cargar la biblioteca.';
  } finally {
    if (current === epoch) busy.value = false;
  }
}
async function loadResources() {
  try {
    const [q, m, u] = await Promise.all([
      apiRequest<{ equipment: StudioEquipment[]; nextCursor: string | null }>(
        `/v1/organizations/${organizationId}/equipment?q=${encodeURIComponent(tab.value === 'equipment' ? search.value : '')}`,
      ),
      staff.value
        ? apiRequest<{ media: MediaAsset[]; nextCursor: string | null }>(
            `/v1/organizations/${organizationId}/media`,
          )
        : Promise.resolve(null),
      staff.value
        ? apiRequest<{ usage: MediaUsage }>(`/v1/organizations/${organizationId}/media/usage`)
        : Promise.resolve(null),
    ]);
    if (disposed) return;
    equipment.value = q.equipment;
    equipmentCursor.value = q.nextCursor;
    assets.value = m?.media ?? [];
    mediaCursor.value = m?.nextCursor ?? null;
    usage.value = u?.usage ?? null;
    if (preview.value?.exercise) {
      const exercise = await apiRequest<{ exercise: LibraryExercise }>(
        `/v1/organizations/${organizationId}/exercises/${preview.value.exercise.id}`,
      );
      if (!disposed && preview.value?.exercise?.id === exercise.exercise.id)
        preview.value = { exercise: exercise.exercise };
    } else if (preview.value?.media) {
      const asset = assets.value.find((m) => m.id === preview.value?.media?.id);
      if (asset) preview.value = { media: asset };
    }
  } catch (e) {
    if (!disposed) error.value = e instanceof Error ? e.message : 'No pudimos cargar los recursos.';
  }
}
async function saved() {
  editor.value = null;
  studio.notify('Cambios guardados en tu estudio.');
  await Promise.all([load(), loadResources()]);
}
async function refreshAll() {
  await Promise.all([load(), loadResources()]);
}
async function uploaded(asset: MediaAsset) {
  assets.value = [asset, ...assets.value.filter((a) => a.id !== asset.id)];
  await loadResources();
}
async function action(asset: MediaAsset, value: 'retry' | 'cancel' | 'delete') {
  error.value = '';
  try {
    await apiRequest(`/v1/organizations/${organizationId}/media/${asset.id}/${value}`, {
      method: 'POST',
    });
    studio.notify(
      value === 'retry'
        ? 'Reintento en cola.'
        : value === 'cancel'
          ? 'Carga cancelada.'
          : 'Medio retirado. Su espacio se recupera al terminar la limpieza.',
    );
    await loadResources();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos cambiar el medio.';
  }
}
async function moreResources(kind: 'equipment' | 'media') {
  const cursor = kind === 'equipment' ? equipmentCursor.value : mediaCursor.value;
  if (!cursor) return;
  try {
    if (kind === 'equipment') {
      const data = await apiRequest<{ equipment: StudioEquipment[]; nextCursor: string | null }>(
        `/v1/organizations/${organizationId}/equipment?cursor=${cursor}`,
      );
      equipment.value.push(...data.equipment);
      equipmentCursor.value = data.nextCursor;
    } else {
      const data = await apiRequest<{ media: MediaAsset[]; nextCursor: string | null }>(
        `/v1/organizations/${organizationId}/media?cursor=${cursor}`,
      );
      assets.value.push(...data.media);
      mediaCursor.value = data.nextCursor;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos cargar más.';
  }
}
watch([search, origin, muscle, state], () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (tab.value === 'equipment') void loadResources();
    else void load();
  }, 250);
});
onMounted(async () => {
  await Promise.all([load(), loadResources()]);
  poll = setInterval(() => {
    if (document.hidden || disposed) return;
    if (
      usage.value?.pending ||
      assets.value.some((a) =>
        ['reserved', 'uploading', 'pending', 'processing'].includes(a.state),
      ) ||
      exercises.value.some((e) => e.media && ['pending', 'processing'].includes(e.media.state))
    ) {
      void loadResources();
      if (tab.value === 'exercises') void load();
    } else if (tab.value === 'media' && staff.value) {
      void apiRequest<{ usage: MediaUsage }>(`/v1/organizations/${organizationId}/media/usage`)
        .then((data) => {
          if (!disposed) usage.value = data.usage;
        })
        .catch(() => {});
    }
  }, 5000);
});
onBeforeUnmount(() => {
  disposed = true;
  epoch++;
  clearTimeout(searchTimer);
  clearInterval(poll);
});
</script>
<template>
  <section class="library-page">
    <div v-show="!editor && !preview">
      <div class="page-heading">
        <div>
          <h1>{{ staff ? 'Ejercicios' : 'Mis ejercicios' }}</h1>
        </div>
        <UiButton
          v-if="staff && tab !== 'media'"
          @click="editor = { kind: tab === 'equipment' ? 'equipment' : 'exercise' }"
          ><Plus :size="17" />{{
            tab === 'equipment' ? 'Nuevo equipo' : 'Nuevo ejercicio'
          }}</UiButton
        >
      </div>
      <UiButton variant="ghost" class="library-refresh" :disabled="busy" @click="refreshAll"
        ><RefreshCw :size="15" />Actualizar biblioteca</UiButton
      >
      <nav v-if="staff" class="library-tabs" aria-label="Secciones de biblioteca">
        <button
          :class="{ active: tab === 'exercises' }"
          @click="
            tab = 'exercises';
            search = '';
          "
        >
          <Dumbbell :size="17" />Ejercicios</button
        ><button
          :class="{ active: tab === 'equipment' }"
          @click="
            tab = 'equipment';
            search = '';
          "
        >
          <Package :size="17" />Equipos</button
        ><button
          :class="{ active: tab === 'media' }"
          @click="
            tab = 'media';
            search = '';
          "
        >
          <Film :size="17" />Medios
        </button>
      </nav>
      <div v-if="tab !== 'media'" class="library-filters">
        <label class="search-field"
          ><Search :size="18" /><input
            v-model="search"
            type="search"
            aria-label="Buscar en biblioteca"
            :placeholder="
              tab === 'equipment'
                ? 'Buscar equipo o ubicación…'
                : 'Buscar ejercicio, instrucción o etiqueta…'
            " /></label
        ><template v-if="tab === 'exercises'"
          ><label class="filter-select"
            ><SlidersHorizontal :size="15" /><select
              v-model="muscle"
              aria-label="Filtrar por grupo muscular"
            >
              <option value="">Todos los grupos</option>
              <option v-for="value in muscleOptions" :key="value">
                {{ value }}
              </option>
            </select></label
          ><label v-if="staff" class="filter-select"
            ><select v-model="origin" aria-label="Origen del ejercicio">
              <option value="all">Toda la biblioteca</option>
              <option value="own">Mi estudio</option>
              <option value="global">Catálogo base</option>
            </select></label
          ><label v-if="staff" class="filter-select"
            ><select v-model="state" aria-label="Estado del ejercicio">
              <option value="all">Todos los estados</option>
              <option value="draft">Borradores</option>
              <option value="published">Publicados</option>
              <option value="archived">Archivados</option>
            </select></label
          ></template
        >
      </div>
      <p v-if="error" class="form-error library-error" role="alert">{{ error }}</p>
      <p v-if="busy && !exercises.length && tab === 'exercises'" class="muted" role="status">
        Cargando tus guías…
      </p>
      <template v-if="tab === 'exercises'"
        ><div class="library-grid">
          <UiCard v-for="exercise in exercises" :key="exercise.id" class="library-exercise-card"
            ><button
              class="library-cover"
              :class="exercise.global ? 'base-cover' : 'studio-cover'"
              :aria-label="`Abrir guía ${exercise.name}`"
              @click="preview = { exercise }"
            >
              <img
                v-if="exercise.media?.state === 'ready'"
                :src="exercise.media.posterUrl!"
                alt=""
                loading="lazy"
              /><img
                v-else-if="exercise.global && exerciseArtwork(exercise.name)"
                class="exercise-art-cover"
                :src="exerciseArtwork(exercise.name)![1]"
                alt=""
                loading="lazy"
              /><ImageOff
                v-else-if="exercise.global"
                class="library-unillustrated-icon"
                aria-hidden="true"
              /><ExerciseSymbol v-else :kind="exercise.visualKey" :name="exercise.name" /><span
                class="library-cover-tag"
                :class="
                  exercise.global
                    ? `equipment-${exerciseEquipmentCategory(exercise.equipmentName || exercise.equipmentTag)}`
                    : ''
                "
                >{{
                  exercise.global
                    ? exerciseEquipmentLabel(exercise.equipmentName || exercise.equipmentTag)
                    : exercise.state === 'published'
                      ? 'Publicado'
                      : exercise.state === 'draft'
                        ? 'Borrador'
                        : 'Archivado'
                }}</span
              ><span
                v-if="!exercise.media && !(exercise.global && exerciseArtwork(exercise.name))"
                class="library-cover-state"
                >{{
                  exercise.global
                    ? 'Sin ilustración'
                    : exercise.visualKey
                      ? 'Símbolo'
                      : 'Sin imagen'
                }}</span
              ><span v-else-if="exercise.media" class="library-cover-state"
                ><Play v-if="exercise.media.kind === 'video'" :size="14" />{{
                  states[exercise.media.state]
                }}</span
              >
            </button>
            <div class="library-card-content">
              <span class="eyebrow">{{ exercise.muscle }}</span>
              <h2>{{ exercise.name }}</h2>
              <p
                v-if="!exercise.global || exercise.instructions.startsWith('Zonas trabajadas:')"
                class="library-excerpt"
              >
                {{ exercise.instructions }}
              </p>
              <div class="library-tags">
                <span>{{ exercise.equipmentName || exercise.equipmentTag || 'Sin material' }}</span
                ><span v-for="tag in exercise.tags.slice(0, 2)" :key="tag">{{ tag }}</span>
              </div>
              <button class="card-detail-button" @click="preview = { exercise }">
                Abrir guía<ArrowUpRight :size="17" />
              </button></div
          ></UiCard>
        </div>
        <div v-if="!exercises.length && !busy" class="empty-state">
          <h2>Sin ejercicios</h2>
          <p>
            {{ staff ? 'Crea uno o cambia los filtros.' : 'Tu coach aún no compartió ejercicios.' }}
          </p>
        </div>
        <UiButton v-if="nextCursor" variant="secondary" :disabled="busy" @click="load(true)"
          >Cargar más ejercicios</UiButton
        > </template
      ><template v-else-if="tab === 'equipment'"
        ><div class="library-grid">
          <UiCard v-for="q in equipmentVisible" :key="q.id"
            ><div class="library-cover equipment-cover">
              <img
                v-if="q.photo?.state === 'ready'"
                :src="q.photo.posterUrl!"
                :alt="q.name"
                loading="lazy"
              /><Package v-else :size="58" :stroke-width="1" /><span class="library-cover-tag">{{
                { available: 'Disponible', maintenance: 'En mantenimiento', archived: 'Archivado' }[
                  q.state
                ]
              }}</span>
            </div>
            <div class="library-card-content">
              <span v-if="q.location" class="eyebrow">{{ q.location }}</span>
              <h2>{{ q.name }}</h2>
              <p v-if="q.description" class="library-excerpt">{{ q.description }}</p>
              <button
                class="card-detail-button"
                @click="editor = { kind: 'equipment', equipment: q }"
              >
                Editar equipo<ArrowUpRight :size="17" />
              </button></div
          ></UiCard>
        </div>
        <div v-if="!equipmentVisible.length" class="empty-state">
          <h2>Sin equipos</h2>
          <p>Añade una máquina o equipo.</p>
        </div>
        <UiButton v-if="equipmentCursor" variant="secondary" @click="moreResources('equipment')"
          >Cargar más equipos</UiButton
        ></template
      ><template v-else
        ><div v-if="usage" class="library-usage">
          <div>
            <span class="eyebrow">ESPACIO DE TU ESTUDIO</span
            ><strong
              >{{ formatBytes(usage.usedBytes) }}
              <small>/ {{ formatBytes(usage.limitBytes) }}</small></strong
            >
            <p>
              {{ Math.ceil(usage.videoSeconds / 60) }} de {{ usage.limitSeconds / 60 }} minutos ·
              {{ usage.pending }} cargas pendientes
            </p>
          </div>
          <span class="status-badge" :class="{ 'status-warning': !usage.workerOnline }"
            ><span />{{
              usage.workerOnline ? 'Procesador disponible' : 'Procesador sin señal'
            }}</span
          >
        </div>
        <p v-if="usage && !usage.workerOnline" class="settings-note">
          Los archivos se guardan en cola. El procesamiento continuará cuando el servicio vuelva a
          estar disponible.
        </p>
        <MediaUploader :organization-id="organizationId" @uploaded="uploaded" />
        <div class="library-grid library-media-grid">
          <UiCard v-for="asset in assets" :key="asset.id"
            ><button
              class="library-cover media-cover"
              :disabled="asset.state !== 'ready'"
              :aria-label="`Previsualizar medio ${asset.id.slice(0, 8)}`"
              @click="preview = { media: asset }"
            >
              <img
                v-if="asset.state === 'ready'"
                :src="asset.posterUrl!"
                alt=""
                loading="lazy"
              /><Film v-else-if="asset.kind === 'video'" :size="42" :stroke-width="1" /><ImageIcon
                v-else
                :size="42"
                :stroke-width="1"
              /><span class="library-cover-tag">{{ states[asset.state] }}</span>
            </button>
            <div class="library-card-content">
              <strong
                >{{ asset.kind === 'video' ? 'Clip' : 'Imagen' }} ·
                {{ asset.id.slice(0, 8) }}</strong
              >
              <p class="small-text muted">
                {{ formatBytes(asset.bytes) }}
                <template v-if="asset.durationSeconds"
                  >· <Clock3 :size="12" />{{ Math.ceil(asset.durationSeconds) }} s</template
                >
              </p>
              <p v-if="asset.errorCode" class="form-error">
                {{
                  mediaErrors[asset.errorCode] ??
                  'No pudimos completar el procesamiento. Reintenta o prepara otro archivo.'
                }}
              </p>
              <div class="library-media-actions">
                <UiButton
                  v-if="asset.state === 'failed' && asset.version < 3"
                  variant="secondary"
                  @click="action(asset, 'retry')"
                  ><RefreshCw :size="15" />Reintentar</UiButton
                ><UiButton
                  v-if="['reserved', 'uploading', 'pending', 'processing'].includes(asset.state)"
                  variant="secondary"
                  @click="action(asset, 'cancel')"
                  >Cancelar</UiButton
                ><button
                  class="icon-button"
                  aria-label="Eliminar medio sin uso"
                  @click="action(asset, 'delete')"
                >
                  <Trash2 :size="17" />
                </button>
              </div></div
          ></UiCard>
        </div>
        <UiButton v-if="mediaCursor" variant="secondary" @click="moreResources('media')"
          >Cargar más medios</UiButton
        ></template
      >
    </div>
    <LibraryEditor
      v-if="editor"
      :organization-id="organizationId"
      v-bind="editor"
      :media="assets"
      :equipment-options="equipment"
      @close="editor = null"
      @saved="saved"
      @uploaded="uploaded"
    /><LibraryPreview
      v-if="preview"
      :organization-id="organizationId"
      v-bind="preview"
      :staff="staff"
      @close="preview = null"
      @edit="editPreview"
    />
  </section>
</template>
