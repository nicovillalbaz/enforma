<script setup lang="ts">
import { computed } from 'vue';
import { ArrowLeft, Phone } from '@lucide/vue';
import { product, creator } from '@forma/shared';
import { useStudio } from '../stores/studio';
import BrandMark from '../components/BrandMark.vue';
import '../coach-start.css';
const studio = useStudio(),
  back = computed(() =>
    studio.user ? (studio.currentOrganization?.role === 'student' ? '/alumno' : '/') : '/acceso',
  );
</script>
<template>
  <main class="information-page coach-space">
    <RouterLink :to="back" class="coach-button secondary"
      ><ArrowLeft :size="17" />{{
        studio.user ? 'Volver a mi espacio' : 'Volver al acceso'
      }}</RouterLink
    >
    <header class="information-header">
      <BrandMark />
      <h1>Información</h1>
    </header>
    <div class="more-groups">
      <section class="ui-card information-card">
        <h2>Por dónde empezar</h2>
        <ol>
          <li>
            <strong>Coach:</strong> crea tu marca, verifica tu correo e invita a tu alumno. Publica
            una rutina y asígnala desde Rutinas.
          </li>
          <li>
            <strong>Alumno:</strong> acepta la invitación, abre Mi plan y registra el entrenamiento
            en Entrenar. Consulta lo que tu coach te comparta.
          </li>
        </ol>
        <RouterLink v-if="!studio.user" to="/registro" class="coach-button secondary"
          >Crear mi espacio de coach</RouterLink
        >
      </section>
      <section class="ui-card information-card">
        <h2>Sin conexión</h2>
        <p>
          Las series pendientes se sincronizan al recuperar conexión. Comprueba su estado antes de
          cerrar sesión o borrar datos del navegador.
        </p>
      </section>
      <section class="ui-card information-card creator-card">
        <span class="eyebrow">QUIÉN LA HA CREADO</span>
        <h2>Creado por {{ creator.name }}</h2>
        <p>{{ creator.signature }}</p>
        <a class="coach-button primary creator-phone" :href="'tel:' + creator.phone"
          ><Phone :size="18" />{{ creator.phone }}</a
        >
      </section>
      <section class="ui-card information-card">
        <span class="eyebrow">FORMA · {{ product.version }}</span>
        <h2>Instalar y condiciones</h2>
        <div class="coach-actions">
          <RouterLink v-if="studio.user" to="/instalar" class="coach-button secondary"
            >Instalar app</RouterLink
          >
          <RouterLink to="/privacidad" class="coach-button secondary">Privacidad</RouterLink
          ><RouterLink to="/condiciones" class="coach-button secondary">Condiciones</RouterLink>
        </div>
      </section>
    </div>
  </main>
</template>
