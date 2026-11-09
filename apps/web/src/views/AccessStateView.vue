<script setup lang="ts">
import { useRouter } from 'vue-router';
import { UiButton } from '@forma/ui';
import { ShieldAlert } from '@lucide/vue';
import { useStudio } from '../stores/studio';
const studio = useStudio();
const router = useRouter();
async function reload() {
  await studio.initialize(true);
  await router.push(studio.currentOrganization?.role === 'student' ? '/alumno' : '/');
}
</script>
<template>
  <section class="access-state ui-card">
    <ShieldAlert :size="36" />
    <h1>Tu acceso necesita atención.</h1>
    <p>
      {{
        studio.currentOrganization?.status === 'suspended'
          ? 'El estudio está suspendido. Contacta con el administrador para revisar su estado.'
          : 'Tu coach pausó o archivó tu acceso. Contacta con él para continuar.'
      }}
    </p>
    <UiButton @click="reload">Comprobar de nuevo</UiButton>
  </section>
</template>
