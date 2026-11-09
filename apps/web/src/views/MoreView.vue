<script setup lang="ts">
import { computed } from 'vue';
import { ArrowUpRight } from '@lucide/vue';
import { useStudio } from '../stores/studio';
import { moreNavigation } from '../navigation';
import '../coach-start.css';
const studio = useStudio(),
  groups = computed(() => [
    ...moreNavigation(
      studio.currentOrganization?.role === 'student',
      studio.isDemo || studio.currentOrganization?.role === 'owner',
    ),
    ...(studio.user?.isSuperadmin
      ? [
          {
            title: 'Administración de plataforma',
            links: [
              {
                to: '/admin',
                title: 'Administración',
                description: 'Organizaciones y operación autorizada de la plataforma.',
              },
            ],
          },
        ]
      : []),
  ]);
</script>
<template>
  <section class="coach-space">
    <header class="coach-heading">
      <span class="eyebrow">TODO A MANO</span>
      <h1>Más opciones</h1>
      <p class="coach-muted">Encuentra lo que necesitas para seguir con tu día.</p>
    </header>
    <div class="more-groups">
      <section v-for="group in groups" :key="group.title" class="ui-card more-group">
        <h2>{{ group.title }}</h2>
        <RouterLink v-for="link in group.links" :key="link.to" :to="link.to" class="more-link"
          ><span
            ><strong>{{ link.title }}</strong
            ><small>{{ link.description }}</small></span
          ><ArrowUpRight :size="18" aria-hidden="true"
        /></RouterLink>
      </section>
    </div>
  </section>
</template>
