<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';
import { confirmAction, useContextGuard } from '../action-review';
import { Check, ImagePlus } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import PageStep from './PageStep.vue';
import type { LibraryExercise, StudioEquipment, MediaAsset } from '@forma/shared';
import { apiRequest } from '../api';
import MediaUploader from './MediaUploader.vue';
import CoachField from './CoachField.vue';
import ExerciseSymbol from './ExerciseSymbol.vue';
import { exerciseSymbols } from '../exercise-symbols';
const props = defineProps<{
  organizationId: string;
  kind: 'exercise' | 'equipment';
  exercise?: LibraryExercise;
  equipment?: StudioEquipment;
  media: MediaAsset[];
  equipmentOptions: StudioEquipment[];
  clone?: boolean;
}>();
const emit = defineEmits<{
  close: [];
  saved: [exercise?: LibraryExercise];
  uploaded: [MediaAsset];
}>();
const item = props.kind === 'exercise' ? props.exercise : props.equipment;
const name = ref(props.clone ? `${item?.name ?? ''} · Mi versión` : (item?.name ?? ''));
const instructions = ref(props.exercise?.instructions ?? '');
const muscle = ref(props.exercise?.muscle ?? '');
const equipmentTag = ref(props.exercise?.equipmentTag ?? '');
const metric = ref(props.exercise?.metric ?? '');
const visualKey = ref<string | null>(props.exercise?.visualKey ?? null);
const variations = ref(props.exercise?.variations.join(', ') ?? '');
const tags = ref(props.exercise?.tags.join(', ') ?? '');
const state = ref(
  props.clone
    ? 'draft'
    : props.kind === 'exercise'
      ? (props.exercise?.state ?? 'draft')
      : (props.equipment?.state ?? 'available'),
);
const equipmentId = ref(props.clone ? null : (props.exercise?.equipmentId ?? null));
const mediaId = ref(
  props.clone
    ? null
    : props.kind === 'exercise'
      ? (props.exercise?.mediaId ?? null)
      : (props.equipment?.photoId ?? null),
);
const description = ref(props.equipment?.description ?? '');
const location = ref(props.equipment?.location ?? '');
const error = ref('');
const busy = ref(false);
const uploadedMedia = ref<MediaAsset[]>([]);
const draft = computed(() =>
  JSON.stringify([
    name.value,
    instructions.value,
    muscle.value,
    equipmentTag.value,
    metric.value,
    visualKey.value,
    variations.value,
    tags.value,
    state.value,
    equipmentId.value,
    mediaId.value,
    description.value,
    location.value,
  ]),
);
let original = draft.value,
  approved = false;
watch(draft, () => {
  approved = false;
});
async function mayLeave() {
  return (
    approved ||
    draft.value === original ||
    (await confirmAction(
      'Tienes cambios sin guardar en el ejercicio o equipo. ¿Quieres descartarlos?',
    ))
  );
}
async function close() {
  if (await mayLeave()) {
    approved = true;
    emit('close');
  }
}
onBeforeRouteLeave(mayLeave);
onBeforeRouteUpdate((to, from) =>
  to.query.edit !== from.query.edit || to.query.createExercise !== from.query.createExercise
    ? mayLeave()
    : true,
);
useContextGuard(mayLeave);
function uploaded(asset: MediaAsset) {
  uploadedMedia.value.unshift(asset);
  mediaId.value = asset.id;
  emit('uploaded', asset);
}
const words = (s: string) =>
  s
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
async function save() {
  busy.value = true;
  error.value = '';
  try {
    const editing = Boolean(item) && !props.clone;
    const body =
      props.kind === 'exercise'
        ? {
            name: name.value,
            instructions: instructions.value,
            muscle: muscle.value,
            equipmentTag: equipmentTag.value,
            metric: metric.value,
            visualKey: visualKey.value,
            variations: words(variations.value),
            tags: words(tags.value),
            state: state.value,
            equipmentId: equipmentId.value,
            mediaId: mediaId.value,
          }
        : {
            name: name.value,
            description: description.value,
            location: location.value,
            state: state.value,
            photoId: mediaId.value,
          };
    const result = await apiRequest<{ exercise?: LibraryExercise }>(
      `/v1/organizations/${props.organizationId}/${props.kind === 'exercise' ? 'exercises' : 'equipment'}${editing ? '/' + item!.id : ''}`,
      {
        method: editing ? 'PUT' : 'POST',
        body: { ...body, ...(editing ? { version: item!.version } : {}) },
      },
    );
    original = draft.value;
    approved = true;
    emit('saved', result.exercise);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos guardar.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <PageStep back-label="Biblioteca" @back="close">
    <form @submit.prevent="save">
      <h2>
        {{
          clone
            ? 'Tu versión del ejercicio'
            : item
              ? 'Editar ' + (kind === 'exercise' ? 'ejercicio' : 'equipo')
              : 'Nuevo ' + (kind === 'exercise' ? 'ejercicio' : 'equipo')
        }}
      </h2>
      <div class="settings-form library-form">
        <label class="field"
          >{{ kind === 'exercise' ? 'Nombre del ejercicio' : 'Nombre del equipo'
          }}<input v-model="name" required minlength="2" maxlength="100" /></label
        ><template v-if="kind === 'exercise'"
          ><label class="field"
            >Instrucciones<textarea
              v-model="instructions"
              required
              minlength="10"
              maxlength="5000"
              rows="4"
              placeholder="Preparación, ejecución y puntos que quieres que recuerde…"
            />
          </label>
          <details class="symbol-selector">
            <summary>Símbolo visual (opcional)</summary>
            <div class="symbol-grid">
              <button
                v-for="symbol in exerciseSymbols"
                :key="symbol.key"
                type="button"
                :class="{ selected: visualKey === symbol.key }"
                @click="visualKey = symbol.key"
              >
                <ExerciseSymbol :kind="symbol.key" /><span>{{ symbol.label }}</span>
              </button>
            </div>
            <button type="button" class="text-button" @click="visualKey = null">Sin símbolo</button>
          </details>
          <div class="library-form-grid">
            <CoachField
              v-model="muscle"
              label="Grupo o categoría"
              field="exercise_group"
              :maxlength="60"
              required
            /><label class="field"
              >Tipo de registro<select v-model="metric" aria-label="Tipo de registro" required>
                <option disabled value="">Seleccionar unidad de registro</option>
                <option value="reps">Repeticiones</option>
                <option value="time">Tiempo</option>
                <option value="distance">Distancia</option>
              </select></label
            >
          </div>
          <CoachField
            v-model="equipmentTag"
            label="Material (opcional)"
            field="equipment_tag"
            :maxlength="60"
          /><label class="field"
            >Equipo de mi estudio<select v-model="equipmentId" aria-label="Equipo de mi estudio">
              <option :value="null">Sin equipo asociado</option>
              <option
                v-for="q in equipmentOptions.filter((q) => q.state !== 'archived')"
                :key="q.id"
                :value="q.id"
              >
                {{ q.name }} · {{ q.location || 'Sin ubicación' }}
              </option>
            </select></label
          ><label class="field"
            >Variaciones<input
              v-model="variations"
              maxlength="600"
              placeholder="Separa hasta 8 variaciones con comas" /></label
          ><label class="field"
            >Etiquetas<input
              v-model="tags"
              maxlength="300"
              placeholder="Separadas por comas" /></label
          ><label class="field"
            >Estado del ejercicio<select
              v-model="state"
              :aria-label="kind === 'exercise' ? 'Estado del ejercicio' : 'Estado del equipo'"
            >
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </select></label
          >
          <p class="small-text muted">
            Publicar prepara la guía. Compártela después solo con los alumnos que deban verla.
          </p></template
        ><template v-else
          ><label class="field"
            >Descripción<textarea v-model="description" maxlength="1000" rows="3" /></label
          ><CoachField
            v-model="location"
            label="Ubicación"
            field="equipment_location"
            :maxlength="100"
          /><label class="field"
            >Estado del equipo<select v-model="state" aria-label="Estado del equipo">
              <option value="available">Disponible</option>
              <option value="maintenance">En mantenimiento</option>
              <option value="archived">Archivado</option>
            </select></label
          ></template
        ><label class="field"
          ><span
            ><ImagePlus :size="15" />{{
              kind === 'exercise' ? 'Foto o clip de la guía' : 'Foto del equipo'
            }}</span
          ><select
            v-model="mediaId"
            :aria-label="kind === 'exercise' ? 'Foto o clip de la guía' : 'Foto del equipo'"
          >
            <option :value="null">Sin medio asociado</option>
            <option
              v-for="asset in [
                ...uploadedMedia.map((u) => media.find((m) => m.id === u.id) ?? u),
                ...media.filter((a) => !uploadedMedia.some((u) => u.id === a.id)),
              ].filter(
                (a) =>
                  ['pending', 'processing', 'ready'].includes(a.state) &&
                  (kind === 'exercise' || a.kind === 'image'),
              )"
              :key="asset.id"
              :value="asset.id"
            >
              {{ asset.kind === 'video' ? 'Clip' : 'Imagen' }} ·
              {{
                asset.state === 'ready'
                  ? 'Listo'
                  : asset.state === 'processing'
                    ? 'Procesando'
                    : 'En cola'
              }}
              · {{ asset.id.slice(0, 8) }}
            </option>
          </select></label
        ><MediaUploader
          :organization-id="organizationId"
          :image-only="kind === 'equipment'"
          @uploaded="uploaded"
        />
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div class="library-editor-actions">
          <UiButton variant="secondary" :disabled="busy" @click="emit('close')">Cancelar</UiButton
          ><UiButton type="submit" :disabled="busy"
            ><Check :size="16" />{{
              busy ? 'Guardando…' : 'Guardar ' + (kind === 'exercise' ? 'ejercicio' : 'equipo')
            }}</UiButton
          >
        </div>
      </div>
    </form>
  </PageStep>
</template>
