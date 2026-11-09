<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import { Play, Clock3, Check, UserPlus, Trash2, ImageOff } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import PageStep from './PageStep.vue';
import ExerciseSymbol from './ExerciseSymbol.vue';
import { exerciseArtwork } from '../exercise-artwork';
import type { LibraryExercise, MediaAsset } from '@forma/shared';
import { apiRequest } from '../api';
import { useStudio } from '../stores/studio';
const props = defineProps<{
  organizationId: string;
  exercise?: LibraryExercise;
  media?: MediaAsset;
  staff: boolean;
}>();
const emit = defineEmits<{ close: []; edit: [] }>();
const studio = useStudio();
const mediaError = ref(false);
const error = ref('');
const busy = ref(false);
const shared = ref<string[]>([]);
const studentId = ref('');
const asset = computed(() => props.exercise?.media ?? props.media);
const artwork = computed(() =>
  props.exercise?.global ? exerciseArtwork(props.exercise.name) : null,
);
const genericBase = computed(
  () =>
    props.exercise?.global &&
    props.exercise.instructions.startsWith('Sigue las indicaciones específicas'),
);
const playbackUrl = ref<string | null>(null);
const preparing = ref(false);
let fallbackTried = false;
let objectUrl: string | undefined;
let disposed = false;
const mediaController = new AbortController();
async function videoError() {
  if (preparing.value) return;
  if (fallbackTried) {
    mediaError.value = true;
    return;
  }
  fallbackTried = true;
  preparing.value = true;
  try {
    const response = await fetch(asset.value!.url!, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: mediaController.signal,
    });
    if (
      !response.ok ||
      !response.headers.get('content-type')?.startsWith('video/mp4') ||
      Number(response.headers.get('content-length')) > 25 * 1024 * 1024
    )
      throw new Error('Media unavailable');
    const blob = await response.blob();
    if (blob.size > 25 * 1024 * 1024 || blob.size === 0) throw new Error('Media size');
    if (disposed) return;
    objectUrl = URL.createObjectURL(blob);
    playbackUrl.value = objectUrl;
    mediaError.value = false;
  } catch {
    if (!disposed) mediaError.value = true;
  } finally {
    preparing.value = false;
  }
}
onBeforeUnmount(() => {
  disposed = true;
  mediaController.abort();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});
const states = {
  reserved: 'Carga preparada',
  uploading: 'Subiendo',
  pending: 'En cola',
  processing: 'Procesando',
  ready: 'Listo',
  failed: 'No se pudo procesar',
  cancelled: 'Cancelado',
  deleted: 'Eliminado',
};
onMounted(async () => {
  if (props.staff && props.exercise && !props.exercise.global) {
    try {
      shared.value = (
        await apiRequest<{ students: string[] }>(
          `/v1/organizations/${props.organizationId}/exercises/${props.exercise.id}/students`,
        )
      ).students;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'No pudimos consultar los accesos.';
    }
  }
});
async function share(id: string, remove = false) {
  busy.value = true;
  error.value = '';
  try {
    const base = `/v1/organizations/${props.organizationId}/exercises/${props.exercise!.id}/students`;
    await apiRequest(remove ? base + '/' + id : base, {
      method: remove ? 'DELETE' : 'POST',
      ...(remove ? {} : { body: { studentId: id } }),
    });
    shared.value = remove
      ? shared.value.filter((value) => value !== id)
      : [...new Set([...shared.value, id])];
    studentId.value = '';
    studio.notify(remove ? 'Acceso a la guía retirado.' : 'Guía compartida con el alumno.');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos cambiar el acceso.';
  } finally {
    busy.value = false;
  }
}
async function refreshStudents() {
  busy.value = true;
  try {
    await studio.refreshStudents();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos actualizar los alumnos.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <PageStep back-label="Volver" @back="emit('close')">
    <h2>
      {{ exercise?.name ?? (asset?.kind === 'video' ? 'Clip del estudio' : 'Imagen del estudio') }}
    </h2>
    <div v-if="exercise" class="library-tags">
      <span>{{ exercise.muscle }}</span
      ><span>{{ exercise.equipmentName || exercise.equipmentTag || 'Sin material' }}</span
      ><span>{{
        { reps: 'Repeticiones', time: 'Tiempo', distance: 'Distancia' }[exercise.metric]
      }}</span>
    </div>
    <div v-if="asset" class="library-player">
      <video
        v-if="asset.state === 'ready' && asset.kind === 'video' && !mediaError"
        :key="playbackUrl ?? asset.url ?? asset.id"
        :src="playbackUrl ?? asset.url!"
        :poster="asset.posterUrl!"
        crossorigin="use-credentials"
        controls
        loop
        playsinline
        preload="metadata"
        @error="videoError"
      /><img
        v-else-if="asset.state === 'ready' && asset.kind === 'image' && !mediaError"
        :src="asset.url!"
        :alt="exercise?.name ?? 'Imagen del estudio'"
        @error="mediaError = true"
      />
      <div v-else class="library-media-fallback">
        <Play :size="28" /><strong>{{
          mediaError ? 'No pudimos cargar el medio.' : states[asset.state]
        }}</strong>
        <p>
          {{
            mediaError
              ? 'Puedes seguir las instrucciones de texto y consultar a tu coach.'
              : 'El archivo estará disponible cuando termine el procesamiento.'
          }}
        </p>
      </div>
      <p v-if="preparing" class="library-preparing" role="status">Preparando vídeo…</p>
      <span v-if="asset.durationSeconds" class="clip-duration"
        ><Clock3 :size="13" />{{ Math.ceil(asset.durationSeconds) }} s</span
      >
    </div>
    <figure v-if="!asset && artwork" class="exercise-art-reference">
      <div
        class="exercise-art-sequence"
        role="img"
        :aria-label="`Dos posturas de ${exercise?.name}`"
      >
        <img
          v-for="(src, index) in artwork"
          :key="src"
          :src="src"
          :class="`exercise-art-frame frame-${index + 1}`"
          alt=""
          aria-hidden="true"
        />
      </div>
      <figcaption>
        Ilustraciones:
        <a href="https://github.com/everkinetic/data" target="_blank" rel="noopener noreferrer"
          >Everkinetic</a
        >
        /
        <a href="https://github.com/bryllim/workout-guide" target="_blank" rel="noopener noreferrer"
          >Bryl Lim</a
        >
        ·
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          >CC BY-SA 4.0</a
        >
      </figcaption>
    </figure>
    <figure v-else-if="!asset && exercise?.global" class="exercise-unillustrated">
      <ImageOff :size="28" aria-hidden="true" /><span>Sin ilustración</span>
    </figure>
    <figure v-else-if="!asset && exercise?.visualKey" class="exercise-visual-reference">
      <ExerciseSymbol :kind="exercise.visualKey" :name="exercise.name" :phase="0" />
    </figure>
    <section v-if="exercise && !genericBase" class="library-instructions">
      <span class="eyebrow">{{ exercise.global ? 'REFERENCIA' : 'INDICACIONES' }}</span>
      <p>{{ exercise.instructions }}</p>
      <template v-if="exercise.variations.length"
        ><h3>Variaciones</h3>
        <ul>
          <li v-for="variation in exercise.variations" :key="variation">{{ variation }}</li>
        </ul></template
      >
      <div class="library-tags">
        <span v-for="tag in exercise.tags" :key="tag">{{ tag }}</span>
      </div>
    </section>
    <UiButton v-if="staff && exercise" variant="secondary" @click="emit('edit')"
      >{{ exercise.global ? 'Usar como base' : 'Editar guía' }}<Check :size="16"
    /></UiButton>
    <section
      v-if="staff && exercise && !exercise.global && exercise.state === 'published'"
      class="library-sharing"
    >
      <h3><UserPlus :size="18" />Compartir con mis alumnos</h3>
      <p class="muted small-text">
        Solo los alumnos elegidos y con acceso activo podrán abrir esta guía y su medio.
      </p>
      <UiButton variant="secondary" :disabled="busy" @click="refreshStudents"
        >Actualizar alumnos</UiButton
      >
      <form class="inline-actions" @submit.prevent="share(studentId)">
        <label class="field"
          >Alumno<select v-model="studentId" aria-label="Alumno" required>
            <option disabled value="">Selecciona un alumno</option>
            <option
              v-for="student in studio.students.filter(
                (s) => !shared.includes(s.id) && s.accessState === 'active',
              )"
              :key="student.id"
              :value="student.id"
            >
              {{ student.name }}
            </option>
          </select></label
        ><UiButton type="submit" :disabled="busy || !studentId">Compartir guía</UiButton>
      </form>
      <UiButton v-if="studio.nextCursor" variant="secondary" @click="studio.loadMoreStudents"
        >Cargar más alumnos</UiButton
      >
      <ul class="library-shared-list">
        <li v-for="id in shared" :key="id">
          <span>{{ studio.students.find((s) => s.id === id)?.name ?? id.slice(0, 8) }}</span
          ><button
            class="icon-button"
            :disabled="busy"
            aria-label="Retirar acceso"
            @click="share(id, true)"
          >
            <Trash2 :size="16" />
          </button>
        </li>
      </ul>
    </section>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
  </PageStep>
</template>
