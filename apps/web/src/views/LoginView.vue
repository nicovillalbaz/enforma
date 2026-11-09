<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowRight, ArrowLeft } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import BrandMark from '../components/BrandMark.vue';
import CreatorSignature from '../components/CreatorSignature.vue';
import '../coach-start.css';
import { useStudio } from '../stores/studio';
import { apiRequest } from '../api';
const studio = useStudio();
const route = useRoute();
const router = useRouter();
const email = ref('');
const password = ref('');
const error = ref('');
const message = ref('');
const loading = ref(false);
const recovery = computed(() => route.path === '/recuperar');
const slug = computed(() =>
  typeof route.params.slug === 'string' ? route.params.slug : undefined,
);
watch(
  slug,
  async (value) => {
    if (value) {
      try {
        await studio.publicBrand(value);
      } catch (e) {
        error.value = e instanceof Error ? e.message : 'Estudio no encontrado.';
      }
    }
  },
  { immediate: true },
);
async function submit() {
  loading.value = true;
  error.value = '';
  message.value = '';
  try {
    const resetToken = route.query.token;
    const endpoint = recovery.value
      ? typeof resetToken === 'string'
        ? '/v1/auth/password-reset/confirm'
        : '/v1/auth/password-reset'
      : '/v1/auth/login';
    const body = recovery.value
      ? typeof resetToken === 'string'
        ? { token: resetToken, password: password.value }
        : { email: email.value }
      : { email: email.value, password: password.value };
    if (recovery.value) {
      const data = await apiRequest<{ message?: string }>(endpoint, { method: 'POST', body });
      message.value = data.message ?? 'Contraseña actualizada. Ya puedes iniciar sesión.';
    } else {
      await studio.login(email.value, password.value, slug.value);
      const next = route.query.next;
      await router.push(
        typeof next === 'string' &&
          /^\/abrir\/[a-z0-9][a-z0-9-]{2,39}(?:\?to=(?:entrenar|progreso))?$/.test(next)
          ? next
          : '/',
      );
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos conectar. Vuelve a intentarlo.';
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <main class="login-layout">
    <div class="login-form-side">
      <RouterLink to="/demo" class="login-back"
        ><ArrowLeft :size="16" /> Explorar ejemplo</RouterLink
      >
      <form class="login-form" @submit.prevent="submit">
        <div class="brand">
          <BrandMark />
          <div>
            <strong>{{ studio.brand.name }}</strong>
          </div>
        </div>
        <h1>{{ recovery ? 'Recuperar acceso' : 'Acceder' }}</h1>
        <label v-if="!recovery || !route.query.token" class="field"
          >Correo electrónico<input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="tu@correo.com" /></label
        ><label v-if="!recovery || route.query.token" class="field"
          >{{ recovery ? 'Nueva contraseña' : 'Contraseña'
          }}<input
            v-model="password"
            type="password"
            required
            :minlength="recovery ? 12 : 1"
            maxlength="256"
            :autocomplete="recovery ? 'new-password' : 'current-password'"
            placeholder="Tu contraseña"
        /></label>
        <p v-if="error" role="alert" class="form-error">{{ error }}</p>
        <p v-if="message" role="status" class="success-message">{{ message }}</p>
        <UiButton type="submit" :disabled="loading" class="full-width"
          >{{ loading ? 'Un momento…' : recovery ? 'Continuar' : 'Entrar a mi espacio'
          }}<ArrowRight :size="17" /></UiButton
        ><RouterLink :to="recovery ? '/acceso' : '/recuperar'" class="login-recovery">{{
          recovery ? 'Volver al acceso' : '¿Olvidaste tu contraseña?'
        }}</RouterLink>
        <div class="login-options">
          <RouterLink to="/registro">Crear mi estudio</RouterLink
          ><RouterLink to="/privacidad">Privacidad</RouterLink>
        </div>
      </form>
      <div class="login-signature"><CreatorSignature /></div>
    </div>
  </main>
</template>
