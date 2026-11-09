<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Download, ArrowRight, Share } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import { installed, installPrompt, requestInstall, pwaError } from '../pwa';
import BrandMark from './BrandMark.vue';
const route = useRoute(),
  mobile = ref(matchMedia('(max-width: 767px) and (pointer: coarse)').matches),
  continued = ref(false),
  ios = ref(false);
let media: MediaQueryList;
const update = () => {
  mobile.value = media.matches;
};
const visible = computed(
  () =>
    mobile.value &&
    !installed.value &&
    !continued.value &&
    !['/invitar', '/verificar', '/privacidad', '/condiciones', '/informacion'].includes(route.path),
);
onMounted(() => {
  media = matchMedia('(max-width: 767px) and (pointer: coarse)');
  update();
  media.addEventListener('change', update);
  ios.value =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  try {
    continued.value = sessionStorage.getItem('forma.install.continued') === '1';
  } catch {
    /* browser session only */
  }
});
onBeforeUnmount(() => media?.removeEventListener('change', update));
function proceed() {
  continued.value = true;
  try {
    sessionStorage.setItem('forma.install.continued', '1');
  } catch {
    /* usable without storage */
  }
}
</script>
<template>
  <main v-if="visible" class="install-welcome">
    <BrandMark />
    <div class="install-welcome-content">
      <h1>Tu espacio, en el móvil.</h1>
      <p>Instala la app para abrirla a pantalla completa.</p>
      <UiButton v-if="installPrompt" class="full-width" @click="requestInstall"
        ><Download :size="18" />Instalar app</UiButton
      >
      <ol v-else-if="ios" class="install-steps">
        <li>Abre el menú de compartir <Share :size="16" />.</li>
        <li>Pulsa Añadir a pantalla de inicio.</li>
        <li>Confirma Añadir y abre el nuevo icono.</li>
      </ol>
      <p v-else class="small-text muted">
        En el menú del navegador, busca Instalar app o Añadir a pantalla de inicio.
      </p>
      <p v-if="pwaError" class="form-error" role="alert">{{ pwaError }}</p>
      <button class="text-button install-continue" @click="proceed">
        Continuar en el navegador<ArrowRight :size="16" />
      </button>
    </div>
    <small>También puedes instalarla más tarde desde Mi perfil.</small>
  </main>
  <slot :show-content="!visible" />
</template>
