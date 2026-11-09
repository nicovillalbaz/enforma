<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Download, RefreshCw } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import type { PrivateResource } from '@forma/shared';
import { apiRequest } from '../api';
import { useStudio } from '../stores/studio';
const studio = useStudio();
const root = `/v1/organizations/${studio.currentOrganization!.id}`;
const items = ref<PrivateResource[]>([]);
const before = ref<string | null>(null);
const busy = ref(false);
const error = ref('');
async function load(more = false) {
  busy.value = true;
  error.value = '';
  try {
    const result = await apiRequest<{ resources: PrivateResource[]; nextBefore: string | null }>(
      root + '/resources' + (more && before.value ? '?before=' + before.value : ''),
    );
    items.value = more ? [...items.value, ...result.resources] : result.resources;
    before.value = result.nextBefore;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos cargar tus documentos.';
  } finally {
    busy.value = false;
  }
}
async function download(item: PrivateResource) {
  if (!item.current || item.current.state !== 'ready') return;
  try {
    const result = await apiRequest<{ url: string }>(
      root + `/resources/${item.id}/versions/${item.current.id}/link`,
      { method: 'POST' },
    );
    window.location.assign(result.url + '?download=1');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos abrir el documento.';
  }
}
onMounted(() => load());
</script>
<template>
  <section class="student-documents">
    <header class="compact-heading">
      <h1>Mis documentos</h1>
      <UiButton variant="secondary" :disabled="busy" @click="load()"
        ><RefreshCw :size="16" />Actualizar</UiButton
      >
    </header>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div v-if="!items.length && !busy" class="empty-state">Sin documentos compartidos.</div>
    <article v-for="item in items" :key="item.id" class="student-document-row">
      <div>
        <strong>{{ item.name }}</strong
        ><small>{{ item.description }}</small>
      </div>
      <UiButton v-if="item.current?.state === 'ready'" variant="secondary" @click="download(item)"
        ><Download :size="16" />Descargar</UiButton
      >
      <span v-else>Preparando</span>
    </article>
    <UiButton v-if="before" variant="secondary" :disabled="busy" @click="load(true)"
      >Ver más</UiButton
    >
  </section>
</template>
