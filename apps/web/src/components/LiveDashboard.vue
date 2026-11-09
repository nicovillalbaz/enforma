<script setup lang="ts">
import { Plus, UsersRound } from '@lucide/vue';
import { UiButton } from '@forma/ui';
import { useStudio } from '../stores/studio';

const studio = useStudio();
</script>

<template>
  <section class="coach-space">
    <header class="coach-heading">
      <h1>Inicio</h1>
      <UiButton @click="studio.showInvite = true"><Plus :size="17" />Nuevo alumno</UiButton>
    </header>
    <div class="coach-metrics">
      <article class="ui-card">
        <UsersRound :size="21" />
        <strong>{{
          studio.subscription?.enabledStudents ??
          studio.students.filter((student) => student.accessState === 'active').length
        }}</strong>
        <span>Alumnos con acceso</span>
      </article>
      <article class="ui-card">
        <strong>{{
          studio.students.filter((student) => student.accessState === 'invited').length
        }}</strong>
        <span>Invitaciones pendientes</span>
      </article>
    </div>
  </section>
</template>
