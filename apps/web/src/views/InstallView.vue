<script setup lang="ts">
import { Download, RefreshCw } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import { useStudio } from '../stores/studio';
import {
  installPrompt,
  updateWaiting,
  installed,
  pwaError,
  requestInstall,
  checkUpdate,
} from '../pwa';
const studio = useStudio();
</script>
<template>
  <section class="install-page">
    <header class="page-heading">
      <h1>Instalar app</h1>
    </header>
    <div class="billing-grid">
      <article class="ui-card install-card">
        <h2>{{ installed ? 'App instalada' : studio.brand.name }}</h2>
        <UiButton v-if="installPrompt && !installed" @click="requestInstall"
          ><Download :size="17" />Instalar aplicación</UiButton
        >
        <p v-else-if="!installed" class="muted">Sigue los pasos de tu dispositivo.</p>
        <a
          v-if="studio.currentOrganization"
          class="text-link"
          :href="'/abrir/' + studio.currentOrganization.slug"
          >Enlace de mi estudio →</a
        >
      </article>
    </div>
    <div class="billing-grid">
      <article class="ui-card install-card">
        <h2>iPhone / iPad</h2>
        <ol>
          <li>Abre el enlace de tu estudio e inicia sesión.</li>
          <li>Abre Compartir y elige Añadir a pantalla de inicio.</li>
          <li>Activa Abrir como app si aparece y pulsa Añadir.</li>
        </ol>
      </article>
      <article class="ui-card install-card">
        <h2>Android / PC</h2>
        <ol>
          <li>Abre el enlace del estudio.</li>
          <li>Usa Instalar aplicación o la opción del menú del navegador.</li>
          <li>Confirma y abre el icono creado.</li>
        </ol>
      </article>
    </div>
    <details class="install-details">
      <summary>Uso sin conexión</summary>
      <p>
        Las series pueden quedar pendientes en este dispositivo hasta que el servidor confirme.
        Fotos y mediciones requieren conexión.
      </p>
    </details>
    <details class="install-details">
      <summary>Actualizar app</summary>
      <p v-if="updateWaiting" role="status">
        Guarda tus cambios y cierra todas las ventanas de Forma para aplicar la nueva versión.
      </p>
      <UiButton variant="secondary" @click="checkUpdate"
        ><RefreshCw :size="16" />Comprobar actualización</UiButton
      >
      <p v-if="pwaError" role="alert" class="form-error">{{ pwaError }}</p>
    </details>
  </section>
</template>
