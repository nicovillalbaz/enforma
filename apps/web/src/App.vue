<script setup lang="ts">
import { watchEffect, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CheckCircle2, X } from '@lucide/vue';
import { brandForeground, brandInk } from '@forma/ui';
import AppLayout from './components/AppLayout.vue';
import InstallWelcome from './components/InstallWelcome.vue';
import ActionReview from './components/ActionReview.vue';
import { actionReview, textReview, answerAction, answerText } from './action-review';
import { useStudio } from './stores/studio';
const route = useRoute(),
  router = useRouter(),
  studio = useStudio();
let toastTimer: ReturnType<typeof setTimeout>;
watchEffect(() => {
  document.documentElement.dataset.theme = studio.theme;
  const accent = /^#[0-9a-f]{6}$/i.test(studio.brand.accent) ? studio.brand.accent : '#005ea8';
  document.documentElement.style.setProperty('--brand', accent);
  document.documentElement.style.setProperty('--brand-text', brandForeground(accent));
  document.documentElement.style.setProperty('--brand-ink', brandInk(accent, studio.theme));
  document.title = `${studio.brand.name} · Forma`;
});
watch(
  () => studio.toast,
  () => {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (studio.toast = ''), 4500);
  },
);
watch(
  () => studio.showInvite,
  (open) => {
    if (!open) return;
    studio.showInvite = false;
    void router.push('/alumnos/nuevo');
  },
);
watch(
  () => route.fullPath,
  () => {
    answerAction(false);
    answerText(null);
  },
);
onBeforeUnmount(() => {
  clearTimeout(toastTimer);
  answerAction(false);
  answerText(null);
});
</script>
<template>
  <InstallWelcome v-slot="{ showContent }">
    <template v-if="showContent">
      <RouterView v-if="route.meta.public" :key="route.fullPath" />
      <AppLayout v-else
        ><div v-show="!actionReview && !textReview">
          <RouterView
            :key="`${studio.currentOrganization?.id ?? 'platform'}:${String(route.params.studentId ?? '')}`"
          />
        </div>
        <ActionReview
      /></AppLayout>
    </template>
  </InstallWelcome>
  <div v-if="studio.toast" class="toast" role="status">
    <CheckCircle2 :size="17" /><span>{{ studio.toast }}</span>
    <button class="icon-button" aria-label="Cerrar aviso" @click="studio.toast = ''">
      <X :size="16" />
    </button>
  </div>
</template>
