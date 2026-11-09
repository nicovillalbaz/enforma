<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, ArrowRight, Check } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import BrandMark from '../components/BrandMark.vue';
import CreatorSignature from '../components/CreatorSignature.vue';
import '../coach-start.css';
import '../monthly.css';
import { useStudio } from '../stores/studio';
import { apiRequest } from '../api';
const studio = useStudio();
const router = useRouter();
const accountExists = computed(() => Boolean(studio.user) && studio.isLive);
const step = ref(accountExists.value ? 1 : 0);
const fullName = ref('');
const email = ref('');
const password = ref('');
const name = ref('');
const slug = ref('');
const customSlug = ref(false);
const accent = ref('#005ea8');
const privacy = ref(false);
const busy = ref(false);
const error = ref('');
function makeSlug() {
  if (!customSlug.value)
    slug.value = name.value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
}
async function submit() {
  error.value = '';
  if (step.value < 2) {
    step.value++;
    return;
  }
  busy.value = true;
  try {
    const body = {
      name: name.value.trim(),
      slug: slug.value,
      kind: 'coach',
      accent: accent.value,
      plan: 'basic',
    };
    const result = accountExists.value
      ? await apiRequest<{ organizationId: string }>('/v1/organizations', { method: 'POST', body })
      : await apiRequest<{ organizationId: string }>('/v1/auth/register-coach', {
          method: 'POST',
          body: {
            ...body,
            fullName: fullName.value,
            email: email.value,
            password: password.value,
            privacyAccepted: privacy.value,
          },
        });
    await studio.afterRegistration(result.organizationId);
    studio.notify('Espacio creado. La administración debe habilitar tu acceso.');
    await router.push('/estado');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos crear el estudio.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <main class="onboarding-page">
    <RouterLink :to="accountExists ? '/' : '/acceso'" class="onboarding-back"
      ><ArrowLeft :size="16" />
      {{ accountExists ? 'Volver a mi estudio' : 'Ya tengo cuenta' }}</RouterLink
    >
    <form class="onboarding-card" @submit.prevent="submit">
      <div class="brand">
        <BrandMark />
        <div><strong>Forma</strong></div>
      </div>
      <div class="step-indicator" aria-label="Pasos del registro">
        <span
          v-for="(label, index) in ['Tu cuenta', 'Tu estudio', 'Tu acceso']"
          :key="label"
          :class="{ current: index === step, complete: index < step }"
          ><i>{{ index < step ? '✓' : index + 1 }}</i
          >{{ label }}</span
        >
      </div>
      <h1>
        {{ ['Crear cuenta', 'Tu estudio', 'Acceso mensual'][step] }}
      </h1>
      <template v-if="step === 0"
        ><label class="field"
          >Tu nombre completo<input
            v-model="fullName"
            required
            minlength="2"
            maxlength="100"
            autocomplete="name" /></label
        ><label class="field"
          >Correo electrónico<input
            v-model="email"
            type="email"
            required
            maxlength="254"
            autocomplete="email" /></label
        ><label class="field"
          >Contraseña<input
            v-model="password"
            type="password"
            required
            minlength="12"
            maxlength="256"
            autocomplete="new-password"
          /><small>Al menos 12 caracteres.</small></label
        ></template
      ><template v-else-if="step === 1"
        ><label class="field"
          >Nombre de tu estudio<input
            v-model="name"
            required
            minlength="2"
            maxlength="40"
            placeholder="Ej. Movimiento Studio"
            @input="makeSlug" /></label
        ><label class="field"
          >Dirección de tu estudio<input
            v-model="slug"
            required
            pattern="[a-z0-9][a-z0-9-]{2,39}"
            maxlength="40"
            placeholder="movimiento-studio"
            @input="customSlug = true"
          /><small
            >/estudio/{{ slug || 'tu-estudio' }} · letras minúsculas, números y guiones</small
          ></label
        >
        <fieldset class="color-field">
          <legend>Un primer color para tu marca</legend>
          <div class="color-options">
            <button
              v-for="color in ['#005ea8', '#19e7d0', '#7055bc', '#1d7655']"
              :key="color"
              type="button"
              :style="{ background: color }"
              :aria-label="`Color ${color}`"
              :aria-pressed="accent === color"
              @click="accent = color"
            >
              <Check v-if="accent === color" :size="18" />
            </button>
          </div></fieldset></template
      ><template v-else
        ><div class="ui-card monthly-card">
          <strong>Habilitación manual</strong>
          <p>La administración define tu cupo y acceso. Los pagos se acuerdan fuera de la app.</p>
        </div>
        <label v-if="!accountExists" class="checkbox-field"
          ><input v-model="privacy" type="checkbox" required /><span
            >He leído el
            <RouterLink to="/privacidad" target="_blank">aviso de privacidad</RouterLink> de esta
            versión de pruebas.</span
          ></label
        ></template
      >
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="onboarding-actions">
        <UiButton
          v-if="step > (accountExists ? 1 : 0)"
          variant="secondary"
          :disabled="busy"
          @click="step--"
          >Atrás</UiButton
        ><UiButton type="submit" :disabled="busy"
          >{{ busy ? 'Creando tu espacio…' : step === 2 ? 'Crear mi estudio' : 'Continuar'
          }}<ArrowRight :size="16"
        /></UiButton>
      </div>
    </form>
    <div class="registration-signature"><CreatorSignature /></div>
  </main>
</template>
