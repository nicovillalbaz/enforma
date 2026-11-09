<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { UiButton } from '@forma/ui';
import { useStudio } from '../stores/studio';
const studio = useStudio(),
  route = useRoute(),
  router = useRouter(),
  error = ref('');
onMounted(async () => {
  try {
    await studio.initialize();
    const slug = String(route.params.slug);
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug))
      throw new Error('Dirección del estudio no válida.');
    if (!studio.user) {
      await router.replace({ path: '/estudio/' + slug, query: { next: route.fullPath } });
      return;
    }
    const org = studio.organizations.find((o) => o.slug === slug);
    if (!org)
      throw new Error(
        studio.offlineMode
          ? 'Conecta para verificar el acceso a este estudio.'
          : 'Esta cuenta no tiene acceso al estudio de esta instalación. Entra con la cuenta invitada.',
      );
    if (studio.currentOrganization?.id !== org.id) await studio.selectOrganization(org.id);
    const target =
      route.query.to === 'entrenar'
        ? '/entrenar'
        : route.query.to === 'progreso'
          ? '/progreso'
          : org.role === 'student'
            ? '/alumno'
            : '/';
    await router.replace(target);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos abrir el estudio.';
  }
});
async function otherAccount() {
  try {
    if ((await studio.logout()) !== false)
      await router.replace('/estudio/' + String(route.params.slug));
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos cerrar sesión.';
  }
}
</script>
<template>
  <main class="onboarding-page">
    <section class="ui-card pwa-launch">
      <h1>Abriendo estudio</h1>
      <p v-if="!error" role="status">Comprobando acceso…</p>
      <template v-else
        ><p role="alert">{{ error }}</p>
        <UiButton @click="otherAccount">Entrar con otra cuenta</UiButton
        ><RouterLink to="/" class="text-link">Volver a mi espacio</RouterLink></template
      >
    </section>
  </main>
</template>
