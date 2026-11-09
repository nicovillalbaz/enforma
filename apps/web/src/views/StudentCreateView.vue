<script setup lang="ts">
import { ref } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import { UiButton } from '@forma/ui';
import { useStudio } from '../stores/studio';
import { confirmAction, useContextGuard } from '../action-review';
import PageStep from '../components/PageStep.vue';
import CoachField from '../components/CoachField.vue';
const studio = useStudio(),
  router = useRouter();
const name = ref(''),
  email = ref(''),
  goal = ref(''),
  busy = ref(false),
  error = ref('');
let saved = false;
async function mayLeave() {
  return (
    saved ||
    !(name.value || email.value || goal.value) ||
    (await confirmAction('Tienes una ficha sin guardar. ¿Quieres descartarla?'))
  );
}
onBeforeRouteLeave(mayLeave);
useContextGuard(mayLeave);
async function save() {
  busy.value = true;
  error.value = '';
  try {
    if (!(await studio.addStudent(name.value, email.value, goal.value)))
      throw new Error('Ya existe una ficha con este correo.');
    saved = true;
    await router.replace('/alumnos');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo crear el alumno.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <PageStep title="Nuevo alumno" back-label="Alumnos" @back="router.push('/alumnos')">
    <form class="flow-form" @submit.prevent="save">
      <label class="field"
        >Nombre completo<input
          v-model="name"
          required
          minlength="2"
          maxlength="100"
          autocomplete="name"
      /></label>
      <label class="field"
        >Correo electrónico<input
          v-model="email"
          type="email"
          required
          maxlength="254"
          autocomplete="email"
      /></label>
      <CoachField v-model="goal" label="Objetivo (opcional)" field="student_goal" />
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <footer class="flow-actions">
        <UiButton type="submit" :disabled="busy">{{
          busy ? 'Guardando…' : 'Crear alumno'
        }}</UiButton>
      </footer>
    </form>
  </PageStep>
</template>
