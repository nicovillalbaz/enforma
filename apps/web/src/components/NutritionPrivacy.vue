<script setup lang="ts">
import { ref, watch } from 'vue';
import { UiButton } from '@forma/ui';
import type { NutritionPrivacy } from '@forma/shared';
import { apiRequest } from '../api';
const props = defineProps<{ root: string; studentId: string; privacy: NutritionPrivacy }>(),
  emit = defineEmits<{ saved: []; dirty: [value: boolean] }>();
const form = ref<NutritionPrivacy>(JSON.parse(JSON.stringify(props.privacy))),
  busy = ref(false),
  error = ref('');
const initial = JSON.stringify(form.value);
watch(form, () => emit('dirty', JSON.stringify(form.value) !== initial), { deep: true });
async function save() {
  busy.value = true;
  error.value = '';
  try {
    await apiRequest(props.root + '/privacy/' + props.studentId, {
      method: 'PUT',
      body: {
        revision: form.value.revision,
        diaryConsent: form.value.diaryConsent,
        photoConsent: form.value.diaryConsent && form.value.photoConsent,
        professionals: [],
      },
    });
    emit('dirty', false);
    emit('saved');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo guardar.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <form class="ui-card nutrition-privacy" @submit.prevent="save">
    <h2>Privacidad de alimentación</h2>
    <p>Tu coach verá el diario solo si lo autorizas. Las fotos necesitan un permiso adicional.</p>
    <p v-if="form.consentVersion && form.consentVersion !== 'nutrition-v2'" class="nutrition-note">
      Tus permisos anteriores no se aplican al coach. Revisa las opciones y guarda para decidir de
      nuevo.
    </p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <label class="nutrition-check"
      ><input v-model="form.diaryConsent" type="checkbox" />Guardar mi diario y compartirlo con mi
      coach.</label
    >
    <label class="nutrition-check"
      ><input v-model="form.photoConsent" :disabled="!form.diaryConsent" type="checkbox" />Acepto
      guardar fotos opcionales de mis comidas y compartirlas con mi coach.</label
    >
    <p class="nutrition-note">
      Puedes retirar el permiso después. La revocación bloquea nuevas consultas del coach; no borra
      copias que ya hayas descargado.
    </p>
    <UiButton type="submit" :disabled="busy">{{
      busy ? 'Guardando…' : 'Guardar mis permisos'
    }}</UiButton>
  </form>
</template>
