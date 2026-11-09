<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowRight, UserRound, CheckCircle2 } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import type { PublicInvitation } from '@forma/shared';
import BrandMark from '../components/BrandMark.vue';
import { apiRequest } from '../api';
import { useStudio } from '../stores/studio';
const route = useRoute();
const router = useRouter();
const studio = useStudio();
const invitation = ref<PublicInvitation | null>(null);
const fullName = ref('');
const goal = ref('');
const password = ref('');
const privacy = ref(false);
const error = ref('');
const busy = ref(false);
const token = typeof route.query.token === 'string' ? route.query.token : '';
onMounted(async () => {
  try {
    const data = await apiRequest<{ invitation: PublicInvitation }>('/v1/invitations/inspect', {
      method: 'POST',
      body: { token },
    });
    invitation.value = data.invitation;
    studio.brand = data.invitation.brand;
    fullName.value = data.invitation.studentName;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos abrir la invitación.';
  }
});
async function accept() {
  busy.value = true;
  error.value = '';
  try {
    const result = await apiRequest<{ organizationId: string }>('/v1/invitations/accept', {
      method: 'POST',
      body: {
        token,
        fullName: fullName.value,
        goal: goal.value,
        privacyAccepted: privacy.value,
        ...(password.value ? { password: password.value } : {}),
      },
    });
    await studio.afterRegistration(result.organizationId);
    studio.notify('Tu espacio ya está listo. Bienvenido.');
    await router.replace('/alumno');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos completar tu acceso.';
  } finally {
    busy.value = false;
  }
}
async function exitAccount() {
  busy.value = true;
  error.value = '';
  try {
    await studio.logout();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos cerrar tu sesión.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="onboarding-page">
    <form class="onboarding-card invitation-card" @submit.prevent="accept">
      <div class="brand">
        <BrandMark />
        <div>
          <strong>{{ invitation?.brand.name ?? 'Tu estudio' }}</strong>
        </div>
      </div>
      <h1>Aceptar invitación</h1>
      <p class="muted">
        {{ invitation?.brand.welcomeMessage ?? 'Abre tu invitación para comenzar.' }}
      </p>
      <template v-if="invitation"
        ><div class="invitation-email">
          <UserRound :size="18" /><span
            >Acceso personal para <strong>{{ invitation.email }}</strong></span
          >
        </div>
        <div
          v-if="studio.user && studio.user.email.toLowerCase() !== invitation.email.toLowerCase()"
          class="settings-note"
        >
          <p>
            Estás conectado con otra cuenta. Cierra esa sesión para continuar con esta invitación.
          </p>
          <UiButton variant="secondary" :disabled="busy" @click="exitAccount"
            >Cerrar sesión actual</UiButton
          >
        </div>
        <label class="field"
          >Tu nombre<input
            v-model="fullName"
            required
            minlength="2"
            maxlength="100"
            autocomplete="name" /></label
        ><label class="field"
          >Tu objetivo principal<input
            v-model="goal"
            maxlength="300"
            placeholder="¿Qué te gustaría conseguir?" /></label
        ><label
          v-if="!studio.user || studio.user.email.toLowerCase() !== invitation.email.toLowerCase()"
          class="field"
          >Tu contraseña<input
            v-model="password"
            type="password"
            required
            maxlength="256"
            autocomplete="new-password"
          /><small
            >Si eres nuevo, usa al menos 12 caracteres. Si ya tienes cuenta, usa tu contraseña
            actual.</small
          ></label
        >
        <p v-else class="success-message">
          <CheckCircle2 :size="16" /> Continuarás con tu cuenta de {{ studio.user.email }}.
        </p>
        <label class="checkbox-field"
          ><input v-model="privacy" type="checkbox" required /><span
            >He leído el
            <RouterLink to="/privacidad" target="_blank">aviso de privacidad</RouterLink> y entiendo
            que mis registros se comparten con los profesionales autorizados de este estudio.</span
          ></label
        ><UiButton type="submit" class="full-width" :disabled="busy"
          >{{ busy ? 'Preparando tu acceso…' : 'Aceptar y entrar'
          }}<ArrowRight :size="16" /></UiButton
      ></template>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <RouterLink v-if="!invitation" to="/acceso" class="login-recovery"
        >Volver al acceso</RouterLink
      >
      <p class="small-text muted">
        La invitación es personal, vence en 72 horas y puede utilizarse una sola vez.
      </p>
    </form>
  </main>
</template>
