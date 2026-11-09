<script setup lang="ts">
import { ref } from 'vue';
import { Mail, CheckCircle2 } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import { useStudio } from '../stores/studio';
import { apiRequest } from '../api';
const studio = useStudio();
const local = import.meta.env.DEV;
const mail = ref<{ url: string; kind: string }[]>([]);
const busy = ref(false);
const error = ref('');
async function inbox() {
  busy.value = true;
  error.value = '';
  try {
    mail.value = (
      await apiRequest<{ emails: { url: string; kind: string }[] }>('/v1/development/emails')
    ).emails;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos abrir el correo.';
  } finally {
    busy.value = false;
  }
}
async function resend() {
  busy.value = true;
  error.value = '';
  try {
    await apiRequest('/v1/auth/verification-email', { method: 'POST' });
    studio.notify('Correo de verificación en cola. Revisa tu bandeja.');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos reenviar el correo.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section
    v-if="studio.isLive && studio.user && !studio.user.emailVerified"
    class="verification-notice"
  >
    <Mail :size="22" />
    <div>
      <strong>Confirma tu correo para invitar alumnos</strong>
      <p>
        Tu cuenta usa {{ studio.user.email }}. Puedes preparar tu estudio mientras confirmas tu
        correo.
      </p>
      <div class="inline-actions">
        <UiButton variant="secondary" :disabled="busy" @click="resend">Reenviar correo</UiButton
        ><UiButton v-if="local" variant="ghost" :disabled="busy" @click="inbox"
          >Abrir correo de desarrollo</UiButton
        >
      </div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div v-if="mail.length" class="development-inbox">
        <span class="eyebrow">BANDEJA LOCAL · SOLO EN ESTE ENTORNO</span
        ><a
          v-for="item in mail.filter((m) => m.kind === 'email.verification').slice(0, 1)"
          :key="item.url"
          :href="item.url"
          ><CheckCircle2 :size="16" /> Abrir enlace de verificación</a
        >
      </div>
    </div>
  </section>
</template>
