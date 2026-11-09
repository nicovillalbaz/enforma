<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  LayoutDashboard,
  UsersRound,
  Dumbbell,
  LibraryBig,
  Palette,
  ArrowUpRight,
  Moon,
  Sun,
  UserRound,
  LogOut,
  CreditCard,
  ShieldCheck,
  Utensils,
  History,
} from '@lucide/vue';
import { allowContextChange } from '../action-review';
import { updateWaiting } from '../pwa';
import BrandMark from './BrandMark.vue';
import VerificationNotice from './VerificationNotice.vue';
import CreatorSignature from './CreatorSignature.vue';
import '../coach-start.css';
import { useStudio } from '../stores/studio';
const route = useRoute();
const router = useRouter();
const studio = useStudio();
const error = ref('');
const learner = computed(() => studio.isLive && studio.currentOrganization?.role === 'student');
const studentView = computed(
  () => learner.value || route.path === '/alumno' || route.path.startsWith('/alumno/'),
);
const owner = computed(() => studio.isDemo || studio.currentOrganization?.role === 'owner');
const nav = computed(() =>
  learner.value
    ? [
        { to: '/alumno', label: 'Hoy', icon: LayoutDashboard },
        { to: '/entrenar', label: 'Entrenar', icon: Dumbbell },
        { to: '/alimentacion', label: 'Comidas', icon: Utensils },
        { to: '/historial', label: 'Historial', icon: History },
      ]
    : [
        { to: '/', label: 'Inicio', icon: LayoutDashboard },
        { to: '/alumnos', label: 'Alumnos', icon: UsersRound },
        { to: '/rutinas', label: 'Rutinas', icon: Dumbbell },
        { to: '/ejercicios', label: 'Ejercicios', icon: LibraryBig },
        { to: '/alimentacion', label: 'Dieta', icon: Utensils },
      ],
);
async function changeOrganization(event: Event) {
  if (!(await allowContextChange())) {
    (event.target as HTMLSelectElement).value = studio.currentOrganization?.id ?? '';
    return;
  }
  await studio.selectOrganization((event.target as HTMLSelectElement).value);
  await router.push(studio.currentOrganization?.role === 'student' ? '/alumno' : '/');
}
async function logout() {
  if (!(await allowContextChange())) return;
  try {
    if ((await studio.logout()) === false) return;
    await router.push('/acceso');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No pudimos cerrar la sesión.';
  }
}
</script>
<template>
  <div class="app-layout" :class="{ 'student-layout': studentView }">
    <a class="skip-link" href="#main-content">Ir al contenido</a>
    <aside class="sidebar">
      <RouterLink :to="learner ? '/alumno' : '/'" class="brand"
        ><BrandMark />
        <div>
          <strong>{{ studio.brand.name }}</strong>
        </div></RouterLink
      ><label
        v-if="studio.isLive && studio.organizations.length > 1"
        class="field organization-picker"
        >Mi estudio<select
          aria-label="Seleccionar estudio"
          :value="studio.currentOrganization?.id"
          :disabled="studio.contextLoading"
          @change="changeOrganization"
        >
          <option v-for="org in studio.organizations" :key="org.id" :value="org.id">
            {{ org.name }}
          </option>
        </select></label
      >
      <nav aria-label="Navegación principal" class="desktop-nav">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :class="{ active: route.path === item.to }"
          ><component :is="item.icon" :size="19" /><span>{{ item.label }}</span></RouterLink
        >
      </nav>
      <nav aria-label="Configuración" class="desktop-nav">
        <RouterLink v-if="owner" to="/marca" :class="{ active: route.path === '/marca' }"
          ><Palette :size="19" /><span>Mi marca</span></RouterLink
        ><RouterLink v-if="studio.isLive && owner" to="/cuenta"
          ><CreditCard :size="19" /><span>Mi mensualidad</span></RouterLink
        ><RouterLink v-if="studio.isLive && studio.user?.isSuperadmin" to="/admin"
          ><ShieldCheck :size="19" /><span>Administración</span></RouterLink
        >
        <RouterLink v-if="studio.isLive && owner" to="/mensualidades"
          ><CreditCard :size="19" /><span>Mensualidades</span></RouterLink
        >
        <RouterLink to="/mi-perfil"><UserRound :size="19" /><span>Mi perfil</span></RouterLink>
      </nav>
      <div class="sidebar-bottom">
        <button class="help-link" @click="logout">
          <LogOut :size="18" />{{ studio.isDemo ? 'Salir del ejemplo' : 'Cerrar sesión' }}
        </button>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="topbar-left">
          <RouterLink :to="learner ? '/alumno' : '/'" class="mobile-brand"
            ><BrandMark small /></RouterLink
          ><span class="breadcrumb-brand">{{ studio.brand.name }}</span
          ><span class="breadcrumb-separator">/</span
          ><span class="breadcrumb-current">{{ route.meta.title }}</span
          ><span v-if="studio.isDemo" class="preview-badge">Ejemplo</span>
        </div>
        <div class="topbar-actions">
          <RouterLink
            to="/mi-perfil"
            class="icon-button profile-shortcut"
            aria-label="Mi perfil"
            :aria-current="route.path === '/mi-perfil' ? 'page' : undefined"
            ><UserRound :size="19"
          /></RouterLink>
          <RouterLink v-if="!learner" :to="studentView ? '/' : '/alumno'" class="preview-link"
            >{{ studentView ? 'Vista coach' : 'Ver mi app' }}<ArrowUpRight :size="14" /></RouterLink
          ><button
            class="icon-button"
            :aria-label="studio.theme === 'light' ? 'Activar tema oscuro' : 'Activar tema claro'"
            @click="studio.toggleTheme"
          >
            <Moon v-if="studio.theme === 'light'" :size="18" /><Sun v-else :size="18" /></button
          ><button class="icon-button mobile-logout" aria-label="Cerrar sesión" @click="logout">
            <LogOut :size="18" />
          </button>
        </div>
      </header>
      <div v-if="studio.isLive && studio.organizations.length > 1" class="mobile-context">
        <label class="field"
          >Mi estudio<select
            aria-label="Cambiar estudio en móvil"
            :value="studio.currentOrganization?.id"
            :disabled="studio.contextLoading"
            @change="changeOrganization"
          >
            <option v-for="org in studio.organizations" :key="org.id" :value="org.id">
              {{ org.name }}
            </option>
          </select></label
        >
      </div>
      <main id="main-content" class="page-content">
        <VerificationNotice />
        <p v-if="updateWaiting" class="pwa-update-notice" role="status">
          Nueva versión preparada. Guarda tus cambios y cierra todas las ventanas para aplicarla.
          <RouterLink to="/instalar">Ver cómo actualizar →</RouterLink>
        </p>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div v-if="studio.contextLoading" class="empty-state" role="status">
          Cargando tu estudio…
        </div>
        <div
          v-else-if="
            studio.contextError && !['/cuenta', '/admin/cuenta', '/instalar'].includes(route.path)
          "
          class="empty-state"
        >
          <h1>No pudimos cargar tu espacio.</h1>
          <p role="alert">{{ studio.contextError }}</p>
          <button class="text-link" @click="studio.refresh">Volver a intentar</button>
        </div>
        <slot v-else />
      </main>
      <footer class="page-footer">
        <CreatorSignature />
      </footer>
    </div>
    <nav
      class="bottom-nav"
      :aria-label="studentView ? 'Navegación del alumno' : 'Navegación móvil'"
    >
      <template v-if="studio.isDemo && studentView"
        ><RouterLink to="/alumno"><LayoutDashboard :size="20" /><span>Hoy</span></RouterLink
        ><RouterLink to="/alumno/entrenar"><Dumbbell :size="20" /><span>Entrenar</span></RouterLink
        ><RouterLink to="/marca"
          ><Palette :size="20" /><span>Mi espacio</span></RouterLink
        ></template
      ><template v-else
        ><RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :class="{ active: route.path === item.to }"
          ><component :is="item.icon" :size="20" /><span>{{ item.label }}</span></RouterLink
        ><RouterLink
          v-if="studio.isDemo && owner"
          to="/marca"
          :class="{ active: route.path === '/marca' }"
          ><Palette :size="20" /><span>Mi marca</span></RouterLink
        ></template
      >
    </nav>
  </div>
</template>
