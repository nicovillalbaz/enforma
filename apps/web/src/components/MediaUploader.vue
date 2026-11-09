<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { UploadCloud, X, CheckCircle2 } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import type { MediaAsset } from '@forma/shared';
import { apiRequest, csrfToken, ApiClientError } from '../api';
const props = defineProps<{ organizationId: string; imageOnly?: boolean }>();
const emit = defineEmits<{ uploaded: [MediaAsset] }>();
const busy = ref(false);
const error = ref('');
const message = ref('');
const filename = ref('');
let controller: AbortController | undefined;
let mediaId: string | undefined;
async function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  error.value = '';
  message.value = '';
  const kind =
    file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name) ? 'video' : 'image';
  if (props.imageOnly && kind !== 'image') {
    error.value = 'El equipo necesita una foto.';
    return;
  }
  if (file.size > (kind === 'video' ? 20 : 5) * 1024 * 1024) {
    error.value = `Elige ${kind === 'video' ? 'un clip de hasta 20 MB' : 'una imagen de hasta 5 MB'}.`;
    return;
  }
  busy.value = true;
  filename.value = file.name;
  controller = new AbortController();
  const timeout = setTimeout(() => controller?.abort('timeout'), 90000);
  try {
    const reserved = await apiRequest<{ media: MediaAsset }>(
      `/v1/organizations/${props.organizationId}/media/uploads`,
      { method: 'POST', body: { kind, bytes: file.size, requestId: crypto.randomUUID() } },
    );
    mediaId = reserved.media.id;
    const response = await fetch(
      `/v1/organizations/${props.organizationId}/media/${mediaId}/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream', 'X-CSRF-Token': await csrfToken() },
        body: file,
        credentials: 'same-origin',
        signal: controller.signal,
      },
    );
    const data = await response.json();
    if (!response.ok) throw new ApiClientError(response.status, data.code, data.message);
    emit('uploaded', data.media);
    message.value = 'Archivo recibido. Su procesamiento está en cola.';
  } catch (e) {
    if (controller.signal.reason === 'user') {
      if (mediaId)
        await apiRequest(`/v1/organizations/${props.organizationId}/media/${mediaId}/cancel`, {
          method: 'POST',
        }).catch(() => {});
      message.value = 'Carga cancelada.';
    } else if (mediaId) {
      try {
        const result = await apiRequest<{ media: MediaAsset }>(
          `/v1/organizations/${props.organizationId}/media/${mediaId}`,
        );
        if (['pending', 'processing', 'ready'].includes(result.media.state)) {
          emit('uploaded', result.media);
          message.value = 'El servidor recibió el archivo. Puedes consultar su estado.';
        } else
          error.value =
            e instanceof Error
              ? e.message
              : 'La carga se interrumpió. Selecciona el archivo de nuevo.';
      } catch {
        error.value = 'No pudimos confirmar la carga. Revisa su estado en Medios antes de repetir.';
      }
    } else error.value = e instanceof Error ? e.message : 'No pudimos iniciar la carga.';
  } finally {
    clearTimeout(timeout);
    busy.value = false;
    input.value = '';
  }
}
function cancel() {
  controller?.abort('user');
}
onBeforeUnmount(cancel);
</script>
<template>
  <section class="media-uploader">
    <div class="media-upload-label">
      <UploadCloud :size="24" />
      <div>
        <strong>{{ imageOnly ? 'Añadir una foto' : 'Añadir foto o clip' }}</strong>
        <p>
          Fotos PNG, JPG, WebP o GIF hasta 5 MB.
          <template v-if="!imageOnly">Clips MP4, MOV o WebM hasta 20 MB y 60 segundos.</template>
        </p>
      </div>
    </div>
    <label class="field"
      ><span class="sr-only">{{ imageOnly ? 'Subir foto' : 'Subir medio' }}</span
      ><input
        type="file"
        :accept="
          imageOnly
            ? 'image/png,image/jpeg,image/webp,image/gif'
            : 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm'
        "
        :disabled="busy"
        @change="upload"
    /></label>
    <div v-if="busy" class="media-upload-progress" role="status">
      <progress aria-label="Subiendo archivo" /><span>Subiendo {{ filename }}…</span
      ><UiButton variant="secondary" @click="cancel"><X :size="16" />Cancelar carga</UiButton>
    </div>
    <p v-if="message" class="success-message" role="status">
      <CheckCircle2 :size="16" />{{ message }}
    </p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
  </section>
</template>
