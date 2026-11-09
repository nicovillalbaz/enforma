<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { UiButton } from '@forma/ui';
import { apiRequest } from '../api';
import { useStudio } from '../stores/studio';
const route = useRoute();
const studio = useStudio();
const done = ref(false);
const error = ref('');
const busy = ref(false);
async function verify() {
  busy.value = true;
  error.value = '';
  try {
    await apiRequest('/v1/auth/verify-email', {
      method: 'POST',
      body: { token: typeof route.query.token === 'string' ? route.query.token : '' },
    });
    done.value = true;
    await studio.initialize(true);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos confirmar tu correo.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="onboarding-page">
    <section class="onboarding-card verification-card">
      <h1>{{ done ? 'Correo confirmado' : 'Verificar correo' }}</h1>
      <UiButton v-if="!done" :disabled="busy" @click="verify">{{
        busy ? 'Confirmando…' : 'Verificar mi correo'
      }}</UiButton
      ><RouterLink
        v-else
        :to="studio.user ? '/' : '/acceso'"
        class="ui-button ui-button--primary"
        >{{ studio.user ? 'Volver a mi estudio' : 'Iniciar sesión' }}</RouterLink
      >
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </section>
  </main>
</template>
