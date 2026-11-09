<script setup lang="ts">
import { watch, ref, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStudio } from '../stores/studio';
import StudentDetails from '../components/StudentDetails.vue';
import PageStep from '../components/PageStep.vue';
const route = useRoute(),
  router = useRouter(),
  studio = useStudio(),
  error = ref('');
let sequence = 0;
onBeforeUnmount(() => {
  sequence++;
});
watch(
  () => route.params.studentId,
  async (id) => {
    if (typeof id !== 'string') return;
    const ticket = ++sequence;
    error.value = '';
    studio.selectedStudent = null;
    try {
      const student = await studio.openStudent(id);
      if (ticket === sequence) studio.selectedStudent = student;
    } catch (e) {
      if (ticket !== sequence) return;
      error.value = e instanceof Error ? e.message : 'No se pudo abrir la ficha.';
    }
  },
  { immediate: true },
);
</script>
<template>
  <PageStep back-label="Alumnos" @back="router.push('/alumnos')">
    <p v-if="error" role="alert" class="form-error">{{ error }}</p>
    <StudentDetails v-else-if="studio.selectedStudent" />
    <p v-else role="status">Cargando ficha…</p>
  </PageStep>
</template>
