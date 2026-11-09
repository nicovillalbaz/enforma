<script setup lang="ts">
import type { FollowupAttachment } from '@forma/shared';
defineProps<{ attachment: FollowupAttachment }>();
</script>
<template>
  <figure class="followup-attachment">
    <figcaption>{{ attachment.name }}</figcaption>
    <template v-if="attachment.state === 'ready' && attachment.url"
      ><img
        v-if="attachment.mimeType?.startsWith('image/')"
        :src="attachment.url"
        :alt="attachment.name"
        loading="lazy"
      /><video
        v-else-if="attachment.mimeType === 'video/mp4'"
        :src="attachment.url"
        :poster="attachment.posterUrl ?? undefined"
        controls
        playsinline
        preload="metadata"
      ></video
      ><audio
        v-else-if="attachment.mimeType === 'audio/mp4'"
        :src="attachment.url"
        controls
        preload="none"
      ></audio
      ><a v-else :href="attachment.url" download>Descargar documento</a></template
    >
    <p v-else class="muted">
      {{
        attachment.state === 'revoked' || attachment.state === 'unavailable'
          ? 'Adjunto no disponible.'
          : attachment.state === 'failed'
            ? 'No se pudo procesar el archivo.'
            : 'Archivo en proceso.'
      }}
    </p>
  </figure>
</template>
