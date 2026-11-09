<script setup lang="ts">
import { Activity, Ruler, FileText } from '@lucide/vue';
import StudentPrograms from './StudentPrograms.vue';
import { useStudio } from '../stores/studio';
const studio = useStudio();
</script>
<template>
  <div class="student-live student-home">
    <h1>
      {{ studio.portal ? `Hola, ${studio.portal.displayName.split(' ')[0]}` : 'Vista del alumno' }}
    </h1>
    <p v-if="studio.portal?.goal" class="muted">{{ studio.portal.goal }}</p>
    <nav class="student-home-actions" aria-label="Mis opciones">
      <RouterLink to="/progreso"><Activity :size="20" />Progreso</RouterLink>
      <RouterLink to="/antropometria"><Ruler :size="20" />Medidas</RouterLink>
      <RouterLink to="/documentos"><FileText :size="20" />Documentos</RouterLink>
    </nav>
    <StudentPrograms v-if="studio.portal" :key="studio.currentOrganization!.id" embedded />
    <p v-else class="demo-caption">
      Las asignaciones aparecerán aquí al entrar con una cuenta de alumno.
    </p>
  </div>
</template>
