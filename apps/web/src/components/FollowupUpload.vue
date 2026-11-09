<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import type { FollowupAttachment } from '@forma/shared';
import { apiRequest, csrfToken } from '../api';
const props = defineProps<{ root: string; threadId: string; pdfEnabled: boolean }>(),
  emit = defineEmits<{ ready: [value: FollowupAttachment]; dirty: [value: boolean] }>();
const busy = ref(false),
  error = ref(''),
  pending = ref<FollowupAttachment>(),
  input = ref<HTMLInputElement>();
let stopped = false,
  timer: ReturnType<typeof setTimeout> | undefined,
  release: (() => void) | undefined;
let controller: AbortController | undefined,
  uploadTimeout: ReturnType<typeof setTimeout> | undefined;
async function refresh() {
  if (!pending.value) return;
  try {
    const value = await apiRequest<FollowupAttachment>(
      props.root + '/attachments/' + pending.value.id,
    );
    if (stopped) return;
    pending.value = value;
    if (value.state === 'ready') {
      emit('ready', value);
      pending.value = undefined;
      emit('dirty', false);
    } else if (['failed', 'cancelled', 'deleted', 'revoked'].includes(value.state)) {
      error.value = 'El archivo no está disponible. Elimínalo y vuelve a elegirlo.';
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos consultar el archivo.';
  }
}
async function upload(event: Event) {
  const el = event.target as HTMLInputElement,
    file = el.files?.[0];
  if (!file) return;
  error.value = '';
  const kind = file.type.startsWith('image/')
    ? 'image'
    : file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('audio/')
        ? 'audio'
        : file.type === 'application/pdf'
          ? 'pdf'
          : null;
  if (
    !kind ||
    file.size === 0 ||
    file.size > (kind === 'video' ? 20 : 5) * 1024 * 1024 ||
    (kind === 'pdf' && !props.pdfEnabled)
  ) {
    error.value =
      'Elige imagen, audio o PDF de hasta 5 MB, o vídeo de hasta 20 MB (máximo 60 s). Los PDF requieren análisis habilitado.';
    el.value = '';
    return;
  }
  busy.value = true;
  emit('dirty', true);
  controller = new AbortController();
  uploadTimeout = setTimeout(() => controller?.abort(), 60000);
  try {
    const saved = await apiRequest<{ id: string; attachment: FollowupAttachment }>(
      props.root + '/threads/' + props.threadId + '/attachments',
      {
        method: 'POST',
        body: {
          requestId: crypto.randomUUID(),
          kind,
          name: file.name.slice(0, 100),
          bytes: file.size,
          versionId: null,
        },
      },
    );
    pending.value = saved.attachment;
    const result = await fetch(props.root + '/attachments/' + saved.id + '/upload', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', 'X-CSRF-Token': await csrfToken() },
      credentials: 'same-origin',
      body: file,
      signal: controller.signal,
    });
    if (!result.ok) {
      const data = await result.json();
      throw new Error(data.message ?? 'La carga no se completó.');
    }
    for (let i = 0; i < 15 && !stopped && pending.value; i++) {
      await refresh();
      if (!pending.value || ['failed', 'revoked'].includes(pending.value.state) || document.hidden)
        break;
      await new Promise<void>((done) => {
        release = done;
        timer = setTimeout(done, 2000);
      });
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'La carga no se completó.';
  } finally {
    if (uploadTimeout) clearTimeout(uploadTimeout);
    busy.value = false;
    el.value = '';
    if (!pending.value) emit('dirty', false);
  }
}
async function cancel() {
  if (!pending.value) return;
  busy.value = true;
  try {
    await apiRequest(props.root + '/attachments/' + pending.value.id + '/revoke', {
      method: 'POST',
    });
    pending.value = undefined;
    error.value = '';
    emit('dirty', false);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo eliminar.';
  } finally {
    busy.value = false;
  }
}
onBeforeUnmount(() => {
  stopped = true;
  controller?.abort();
  if (uploadTimeout) clearTimeout(uploadTimeout);
  if (timer) clearTimeout(timer);
  release?.();
});
</script>
<template>
  <div class="followup-upload">
    <input
      ref="input"
      type="file"
      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/*,application/pdf"
      aria-label="Elegir adjunto privado"
      :disabled="busy || !!pending"
      @change="upload"
    /><span v-if="busy" role="status">Subiendo o procesando…</span>
    <div v-if="pending">
      <span>{{ pending.name }} · {{ pending.state }}</span
      ><button type="button" class="button button-ghost" :disabled="busy" @click="refresh">
        Consultar estado</button
      ><button type="button" class="button button-ghost" :disabled="busy" @click="cancel">
        Eliminar carga
      </button>
    </div>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
  </div>
</template>
