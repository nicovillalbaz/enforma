import { createRouter, createWebHistory } from 'vue-router';
import { useStudio } from './stores/studio';
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/alumnos/nuevo',
      component: () => import('./views/StudentCreateView.vue'),
      meta: { title: 'Nuevo alumno', section: 'alumnos' },
    },
    {
      path: '/alumnos/:studentId',
      name: 'student-detail',
      component: () => import('./views/StudentDetailView.vue'),
      meta: { title: 'Ficha del alumno', section: 'alumnos' },
    },
    {
      path: '/alumnos/:studentId/exportar',
      component: () => import('./views/StudentExportView.vue'),
      meta: { title: 'Exportar alumno', section: 'alumnos' },
    },
    {
      path: '/mensualidades',
      component: () => import('./views/MonthlyStudentsView.vue'),
      meta: { title: 'Mensualidades', section: 'alumnos' },
    },
    {
      path: '/informacion',
      component: () => import('./views/InformationView.vue'),
      meta: { public: true, title: 'Información y ayuda' },
    },
    {
      path: '/mas',
      redirect: '/mi-perfil',
    },
    {
      path: '/servicios',
      component: () => import('./views/CommerceView.vue'),
      meta: { title: 'Servicios y pagos', section: 'servicios' },
    },
    {
      path: '/agenda',
      component: () => import('./views/AgendaView.vue'),
      meta: { title: 'Agenda', section: 'agenda' },
    },
    {
      path: '/seguimiento',
      component: () => import('./views/FollowupView.vue'),
      meta: { title: 'Chat y seguimiento', section: 'seguimiento' },
    },
    {
      path: '/alimentacion',
      component: () => import('./views/NutritionView.vue'),
      meta: { title: 'Alimentación' },
    },
    {
      path: '/recursos',
      component: () => import('./views/ResourcesView.vue'),
      meta: { title: 'Recursos y documentos' },
    },
    {
      path: '/condiciones',
      component: () => import('./views/TermsView.vue'),
      meta: { public: true },
    },
    {
      path: '/abrir/:slug',
      component: () => import('./views/PwaLaunchView.vue'),
      meta: { public: true },
    },
    {
      path: '/instalar',
      component: () => import('./views/InstallView.vue'),
      meta: { title: 'Instalar app' },
    },
    {
      path: '/cuenta',
      component: () => import('./views/BillingView.vue'),
      meta: { title: 'Mi cuenta' },
    },
    {
      path: '/admin/cuenta',
      redirect: '/admin',
    },
    {
      path: '/progreso',
      component: () => import('./views/ProgressView.vue'),
      meta: { title: 'Progreso' },
    },
    {
      path: '/antropometria',
      component: () => import('./views/AnthropometryView.vue'),
      meta: { title: 'Antropometría' },
    },
    {
      path: '/entrenar',
      component: () => import('./views/WorkoutView.vue'),
      meta: { title: 'Entrenar' },
    },
    {
      path: '/historial',
      component: () => import('./views/WorkoutHistoryView.vue'),
      meta: { title: 'Historial' },
    },
    {
      path: '/documentos',
      component: () => import('./views/StudentDocumentsView.vue'),
      meta: { title: 'Mis documentos' },
    },
    {
      path: '/mi-programa',
      component: () => import('./views/ProgramStudentView.vue'),
      meta: { title: 'Mi programa' },
    },
    {
      path: '/biblioteca',
      component: () => import('./views/LibraryView.vue'),
      meta: { title: 'Mis guías' },
    },
    { path: '/demo', redirect: '/' },
    {
      path: '/registro',
      component: () => import('./views/RegisterView.vue'),
      meta: { public: true },
    },
    {
      path: '/crear-estudio',
      component: () => import('./views/RegisterView.vue'),
      meta: { title: 'Crear otro estudio' },
    },
    {
      path: '/invitar',
      component: () => import('./views/InvitationView.vue'),
      meta: { public: true },
    },
    {
      path: '/verificar',
      component: () => import('./views/VerificationView.vue'),
      meta: { public: true },
    },
    {
      path: '/privacidad',
      component: () => import('./views/PrivacyView.vue'),
      meta: { public: true },
    },
    {
      path: '/estudio/:slug',
      component: () => import('./views/LoginView.vue'),
      meta: { public: true },
    },
    { path: '/plan', component: () => import('./views/PlanView.vue'), meta: { title: 'Mi plan' } },
    {
      path: '/admin',
      component: () => import('./views/AdminView.vue'),
      meta: { title: 'Administración SaaS', admin: true },
    },
    {
      path: '/mi-perfil',
      component: () => import('./views/ProfileView.vue'),
      meta: { title: 'Mi perfil' },
    },
    {
      path: '/estado',
      component: () => import('./views/AccessStateView.vue'),
      meta: { title: 'Estado del acceso' },
    },
    {
      path: '/',
      component: () => import('./views/DashboardView.vue'),
      meta: { title: 'Mi espacio', section: 'inicio' },
    },
    {
      path: '/alumnos',
      component: () => import('./views/WorkspaceView.vue'),
      meta: { title: 'Alumnos', section: 'alumnos' },
    },
    {
      path: '/rutinas',
      component: () => import('./views/WorkspaceView.vue'),
      meta: { title: 'Programas de entrenamiento', section: 'rutinas' },
    },
    {
      path: '/ejercicios',
      component: () => import('./views/WorkspaceView.vue'),
      meta: { title: 'Biblioteca de ejercicios', section: 'ejercicios' },
    },
    {
      path: '/marca',
      component: () => import('./views/BrandView.vue'),
      meta: { title: 'Mi marca', section: 'marca' },
    },
    {
      path: '/sistema',
      component: () => import('./views/SystemView.vue'),
      meta: { title: 'Sistema visual', section: 'sistema' },
    },
    {
      path: '/alumno',
      component: () => import('./views/StudentView.vue'),
      meta: { title: 'Mi entrenamiento', section: 'alumno' },
    },
    {
      path: '/alumno/entrenar',
      component: () => import('./views/StudentView.vue'),
      meta: { title: 'Sesión de hoy', section: 'alumno' },
    },
    { path: '/acceso', component: () => import('./views/LoginView.vue'), meta: { public: true } },
    {
      path: '/recuperar',
      component: () => import('./views/LoginView.vue'),
      meta: { public: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
const chunkRetryKey = 'forma.route-chunk-retry';
router.onError((error, to) => {
  if (
    !/failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i.test(
      error.message,
    )
  )
    return;
  if (sessionStorage.getItem(chunkRetryKey) === to.fullPath) return;
  sessionStorage.setItem(chunkRetryKey, to.fullPath);
  void (async () => {
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) {
        const changed = new Promise<void>((resolve) => {
          const timeout = window.setTimeout(resolve, 2500);
          navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => {
              window.clearTimeout(timeout);
              resolve();
            },
            { once: true },
          );
        });
        await registration.update();
        if (registration.installing || registration.waiting) await changed;
      }
    } catch {
      /* A normal reload still recovers an uncached build. */
    }
    window.location.replace(to.fullPath);
  })();
});
router.afterEach((_to, _from, failure) => {
  if (!failure) sessionStorage.removeItem(chunkRetryKey);
});
router.beforeEach(async (to) => {
  const studio = useStudio();
  if (to.redirectedFrom?.path === '/demo') {
    studio.enterDemo();
    return;
  }
  if (to.meta.public) return;
  if (studio.isDemo) return to.meta.admin ? { path: '/' } : true;
  await studio.initialize();
  if (
    !studio.offlineMode &&
    studio.currentOrganization &&
    studio.brand.slug !== studio.currentOrganization.slug
  )
    await studio.selectOrganization(studio.currentOrganization.id);
  if (!studio.user) return { path: '/acceso', query: { next: to.fullPath } };
  if (studio.offlineMode && !['/entrenar', '/historial', '/instalar'].includes(to.path))
    return { path: '/entrenar' };
  if (to.meta.admin) return studio.user.isSuperadmin ? true : { path: '/' };
  if (to.path === '/crear-estudio') return;
  const org = studio.currentOrganization;
  if (!org) return { path: studio.user.isSuperadmin ? '/admin' : '/crear-estudio' };
  if (org.status === 'suspended' || (org.role === 'student' && org.studentStatus !== 'active'))
    return to.path === '/estado' || (org.role === 'owner' && to.path === '/cuenta')
      ? true
      : { path: '/estado' };
  if (org.role === 'student' && to.path === '/alumno/entrenar') return { path: '/entrenar' };
  if (
    org.role === 'student' &&
    ![
      '/alumno',
      '/mi-perfil',
      '/biblioteca',
      '/mi-programa',
      '/entrenar',
      '/historial',
      '/documentos',
      '/progreso',
      '/antropometria',
      '/instalar',
      '/recursos',
      '/alimentacion',
      '/seguimiento',
      '/agenda',
      '/servicios',
      '/mas',
    ].includes(to.path)
  )
    return { path: '/alumno' };
  if (org.role !== 'owner' && ['/marca', '/plan', '/cuenta', '/mensualidades'].includes(to.path))
    return { path: org.role === 'student' ? '/alumno' : '/' };
});
