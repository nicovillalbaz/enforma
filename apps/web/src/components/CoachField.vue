<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useStudio } from '../stores/studio';
import {
  coachOptions,
  loadCoachOptions,
  rememberCoachOption,
  type CoachFieldKey,
} from '../coach-options';
const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    field: CoachFieldKey;
    required?: boolean;
    maxlength?: number;
  }>(),
  { required: false, maxlength: 300 },
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const studio = useStudio(),
  organizationId = studio.currentOrganization?.id;
const options = organizationId ? coachOptions(organizationId) : ref([]);
const busy = ref(false),
  error = ref(''),
  expanded = ref(false);
const choices = computed(() => options.value.filter((o) => o.field === props.field));
const known = computed(() =>
  choices.value.some(
    (o) => o.value.toLocaleLowerCase() === props.modelValue.trim().toLocaleLowerCase(),
  ),
);
onMounted(async () => {
  if (!organizationId || !studio.isLive || studio.currentOrganization?.role !== 'owner') return;
  try {
    await loadCoachOptions(organizationId);
  } catch {
    error.value = 'No se pudieron cargar tus opciones. Puedes escribir igualmente.';
  }
});
async function remember() {
  if (!organizationId || !props.modelValue.trim() || known.value) return;
  busy.value = true;
  error.value = '';
  try {
    await rememberCoachOption(organizationId, props.field, props.modelValue);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar la opción.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="coach-field">
    <label class="field"
      >{{ label
      }}<input
        :value="modelValue"
        :maxlength="maxlength"
        :required="required"
        autocomplete="off"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    /></label>
    <div
      v-if="organizationId && studio.isLive && studio.currentOrganization?.role === 'owner'"
      class="coach-field-tools"
    >
      <button
        v-if="modelValue.trim() && !known"
        type="button"
        :disabled="busy"
        class="text-button"
        @click="remember"
      >
        {{ busy ? 'Guardando…' : 'Guardar opción para reutilizar' }}
      </button>
      <button
        v-if="choices.length"
        type="button"
        class="text-button"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        Mis opciones ({{ choices.length }})
      </button>
    </div>
    <div v-if="expanded" class="coach-choice-list" :aria-label="'Opciones de ' + label">
      <button
        v-for="choice in choices"
        :key="choice.id"
        type="button"
        @click="
          emit('update:modelValue', choice.value);
          expanded = false;
        "
      >
        {{ choice.value }}
      </button>
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
  </div>
</template>
