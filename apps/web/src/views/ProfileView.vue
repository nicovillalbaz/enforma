<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Palette, CreditCard, ShieldCheck, Download, Info, LogOut } from '@lucide/vue';
import { useRouter } from 'vue-router';
import { UiButton, UiCard } from '@forma/ui';
import { apiRequest } from '../api';
import { useStudio } from '../stores/studio';
import type { StudentRecord } from '@forma/shared';
import { allowContextChange } from '../action-review';
const studio = useStudio();
const router = useRouter();
const learner = computed(() => studio.currentOrganization?.role === 'student');
const name = ref(studio.portal?.displayName ?? '');
const goal = ref(studio.portal?.goal ?? '');
const busy = ref(false);
const error = ref('');
watch(
  () => studio.portal,
  (portal) => {
    name.value = portal?.displayName ?? '';
    goal.value = portal?.goal ?? '';
  },
);
async function logout() {
  if (!(await allowContextChange())) return;
  try {
    if ((await studio.logout()) !== false) await router.push('/acceso');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos cerrar la sesión.';
  }
}
async function save() {
  busy.value = true;
  error.value = '';
  try {
    const data = await apiRequest<{ student: StudentRecord }>(
      `/v1/organizations/${studio.currentOrganization!.id}/portal/profile`,
      { method: 'PUT', body: { displayName: name.value, goal: goal.value } },
    );
    studio.portal = data.student;
    studio.notify('Tu perfil se actualizó.');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos guardar.';
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="page-heading">
    <div><h1>Mi perfil</h1></div>
  </div>
  <section v-if="!learner" class="profile-overview">
    <UiCard v-if="!studio.isDemo" title="Mi cuenta">
      <dl class="profile-facts">
        <div>
          <dt>Nombre</dt>
          <dd>{{ studio.user?.fullName || 'Sin nombre' }}</dd>
        </div>
        <div>
          <dt>Correo</dt>
          <dd>{{ studio.user?.email || 'Sin correo' }}</dd>
        </div>
        <div>
          <dt>Estudio</dt>
          <dd>{{ studio.currentOrganization?.name || studio.brand.name }}</dd>
        </div>
        <div>
          <dt>Acceso</dt>
          <dd>
            {{ studio.currentOrganization?.status === 'suspended' ? 'Suspendido' : 'Habilitado' }}
          </dd>
        </div>
      </dl>
    </UiCard>
    <nav aria-label="Opciones de mi cuenta" class="profile-links">
      <RouterLink v-if="studio.currentOrganization?.role === 'owner' || studio.isDemo" to="/marca"
        ><Palette :size="18" />Mi marca</RouterLink
      >
      <RouterLink v-if="studio.currentOrganization?.role === 'owner'" to="/cuenta"
        ><CreditCard :size="18" />Mi mensualidad</RouterLink
      >
      <RouterLink to="/recuperar"><ShieldCheck :size="18" />Restablecer contraseña</RouterLink>
      <RouterLink to="/instalar"><Download :size="18" />Instalar app</RouterLink>
      <RouterLink to="/informacion"><Info :size="18" />Información y créditos</RouterLink>
      <button type="button" @click="logout"><LogOut :size="18" />Cerrar sesión</button>
    </nav>
  </section>
  <UiCard v-if="learner && studio.portal" title="Mis datos"
    ><form class="settings-form narrow-form" @submit.prevent="save">
      <label class="field"
        >Nombre completo<input
          v-model="name"
          required
          minlength="2"
          maxlength="100"
          autocomplete="name" /></label
      ><label class="field">Mi objetivo<textarea v-model="goal" maxlength="300" rows="3" /></label>
      <p class="muted">{{ studio.user?.email }}</p>
      <p v-if="error" role="alert" class="form-error">{{ error }}</p>
      <UiButton type="submit" :disabled="busy">{{
        busy ? 'Guardando…' : 'Guardar mi perfil'
      }}</UiButton>
    </form></UiCard
  >
  <p v-if="learner && !studio.portal" role="status">Cargando perfil…</p>
  <nav v-if="learner" aria-label="Opciones de mi cuenta" class="profile-links">
    <RouterLink to="/recuperar"><ShieldCheck :size="18" />Restablecer contraseña</RouterLink>
    <RouterLink to="/instalar"><Download :size="18" />Instalar app</RouterLink>
    <RouterLink to="/informacion"><Info :size="18" />Información y créditos</RouterLink>
    <button type="button" @click="logout"><LogOut :size="18" />Cerrar sesión</button>
  </nav>
  <p v-if="error && !learner" role="alert" class="form-error">{{ error }}</p>
</template>
