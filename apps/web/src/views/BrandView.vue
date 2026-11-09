<script setup lang="ts">
import { ref, watch } from 'vue';
import { Check, ArrowUpRight, Sun, Moon, Smartphone } from '@lucide/vue';
import { UiButton, UiCard, brandForeground } from '@forma/ui';
import { useStudio } from '../stores/studio';
const studio = useStudio();
const name = ref(studio.brand.name);
const accent = ref(studio.brand.accent);
const welcome = ref(studio.brand.welcomeMessage ?? '');
const biography = ref(studio.brand.biography ?? '');
const contact = ref(studio.brand.contactEmail ?? '');
const busy = ref(false);
const error = ref('');
watch(
  () => studio.currentOrganization?.id,
  () => {
    name.value = studio.brand.name;
    accent.value = studio.brand.accent;
    welcome.value = studio.brand.welcomeMessage ?? '';
    biography.value = studio.brand.biography ?? '';
    contact.value = studio.brand.contactEmail ?? '';
  },
);
async function perform(task: () => Promise<unknown>) {
  busy.value = true;
  error.value = '';
  try {
    await task();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos guardar la marca.';
  } finally {
    busy.value = false;
  }
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 262144) {
    error.value = 'Elige una imagen de hasta 256 KB.';
    return;
  }
  await perform(async () => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('No pudimos leer la imagen.'));
      reader.readAsDataURL(file);
    });
    await studio.uploadLogo(dataUrl);
  });
  input.value = '';
}
const colors = [
  { name: 'Azul estudio', hex: '#005ea8' },
  { name: 'Cian energía', hex: '#19e7d0' },
  { name: 'Violeta balance', hex: '#7055bc' },
  { name: 'Verde origen', hex: '#1d7655' },
  { name: 'Terracota', hex: '#a94a38' },
  { name: 'Azul noche', hex: '#071022' },
];
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>Mi marca</h1>
    </div>
  </div>
  <div class="brand-columns">
    <UiCard title="Datos del estudio"
      ><form
        class="settings-form"
        @submit.prevent="
          perform(() =>
            studio.saveBrand(name, accent, {
              welcomeMessage: welcome,
              biography,
              contactEmail: contact.trim() || null,
            }),
          )
        "
      >
        <label class="field"
          >Nombre de tu estudio<input
            v-model="name"
            required
            minlength="2"
            maxlength="40"
            placeholder="Nico Studio"
        /></label>
        <fieldset class="color-field">
          <legend>Elige tu color principal</legend>
          <div class="color-options">
            <button
              v-for="color in colors"
              :key="color.hex"
              type="button"
              :style="{ background: color.hex }"
              :aria-label="color.name"
              :aria-pressed="accent === color.hex"
              :class="{ selected: accent === color.hex }"
              @click="accent = color.hex"
            >
              <Check v-if="accent === color.hex" :size="18" />
            </button>
          </div>
        </fieldset>
        <template v-if="studio.isLive"
          ><label class="field"
            >Mensaje de bienvenida<textarea v-model="welcome" maxlength="200" rows="2" /></label
          ><label class="field"
            >Sobre tu estudio<textarea v-model="biography" maxlength="1000" rows="3" /></label
          ><label class="field"
            >Correo público de contacto<input
              v-model="contact"
              type="email"
              maxlength="254"
            /><small>Se muestra en el acceso público de tu estudio.</small></label
          ><label class="field"
            >Logo del estudio<input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              :disabled="busy"
              @change="upload"
            /><small>PNG, JPEG o WebP · hasta 256 KB y 2048 × 2048 píxeles.</small></label
          ><button
            v-if="studio.brand.logoUrl"
            type="button"
            class="text-link"
            :disabled="busy"
            @click="perform(studio.removeLogo)"
          >
            Quitar logo
          </button></template
        >
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <UiButton type="submit" :disabled="busy"><Check :size="17" /> Guardar mi marca</UiButton>
        <p v-if="studio.isDemo" class="muted small-text">
          Configuración local de ejemplo. Los cambios se conservan en este navegador.
        </p>
        <RouterLink v-else :to="`/estudio/${studio.brand.slug}`" class="text-link"
          >Abrir acceso de mi estudio <ArrowUpRight :size="16"
        /></RouterLink></form
    ></UiCard>
    <div>
      <div class="brand-preview" aria-label="Vista previa de la marca">
        <span
          class="brand-preview-mark"
          :style="{ background: accent, color: brandForeground(accent) }"
        >
          <img v-if="studio.brand.logoUrl" :src="studio.brand.logoUrl" alt="" />
          <span v-else>{{ name.trim().charAt(0).toUpperCase() || 'F' }}</span>
        </span>
        <strong>{{ name.trim() || 'Tu estudio' }}</strong>
      </div>
      <button class="theme-setting" @click="studio.toggleTheme()">
        <Sun v-if="studio.theme === 'light'" :size="19" /><Moon v-else :size="19" /><span
          >Tema {{ studio.theme === 'light' ? 'claro' : 'oscuro' }}</span
        ><span>Cambiar</span></button
      ><RouterLink to="/alumno" class="theme-setting"
        ><Smartphone :size="19" /><span>Explorar la vista del alumno</span><ArrowUpRight :size="17"
      /></RouterLink>
    </div>
  </div>
</template>
