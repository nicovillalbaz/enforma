import { defineStore } from 'pinia';
import { confirmAction } from '../action-review';
import { ref, computed } from 'vue';
import type {
  Brand,
  CurrentUser,
  OrganizationSummary,
  StudentRecord,
  StudentState,
  Subscription,
} from '@forma/shared';
import { apiRequest, ApiClientError } from '../api';
import {
  readOfflineContext,
  forgetOfflineContext,
  pendingForUser,
  purgeWorkouts,
  stopWorkoutSync,
} from '../workout-cache';

export interface Student {
  id: string;
  name: string;
  email: string;
  initials: string;
  goal: string;
  program: string;
  status: string;
  accessState?: StudentState;
  version?: number;
  userId?: string | null;
  color: string;
  completed: number;
  total: number;
}
export interface Exercise {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  sets: number;
  reps: string;
  weight: number;
  color: string;
}
const defaults: Student[] = [
  {
    id: 'ana',
    name: 'Ana Benítez',
    email: 'ana@example.test',
    initials: 'AB',
    goal: 'Ganar fuerza',
    program: 'Fuerza · Semana 3',
    status: 'Al día',
    color: 'peach',
    completed: 3,
    total: 4,
  },
  {
    id: 'carlos',
    name: 'Carlos Martínez',
    email: 'carlos@example.test',
    initials: 'CM',
    goal: 'Masa muscular',
    program: 'Hipertrofia · Semana 2',
    status: 'Por revisar',
    color: 'blue',
    completed: 2,
    total: 4,
  },
  {
    id: 'lucia',
    name: 'Lucía Fernández',
    email: 'lucia@example.test',
    initials: 'LF',
    goal: 'Bienestar',
    program: 'Full body · Semana 4',
    status: 'Al día',
    color: 'purple',
    completed: 3,
    total: 3,
  },
  {
    id: 'diego',
    name: 'Diego López',
    email: 'diego@example.test',
    initials: 'DL',
    goal: 'Ganar fuerza',
    program: 'Fuerza · Semana 1',
    status: 'Sin actividad',
    color: 'green',
    completed: 0,
    total: 3,
  },
];
export const exercises: Exercise[] = [
  {
    id: 'squat',
    name: 'Sentadilla con barra',
    muscle: 'Piernas',
    equipment: 'Barra',
    sets: 4,
    reps: '8–10',
    weight: 60,
    color: 'cyan',
  },
  {
    id: 'press',
    name: 'Press de banca',
    muscle: 'Pecho',
    equipment: 'Barra',
    sets: 4,
    reps: '10–12',
    weight: 40,
    color: 'blue',
  },
  {
    id: 'row',
    name: 'Remo con mancuerna',
    muscle: 'Espalda',
    equipment: 'Mancuerna',
    sets: 3,
    reps: '10–12',
    weight: 20,
    color: 'purple',
  },
  {
    id: 'plank',
    name: 'Plancha abdominal',
    muscle: 'Core',
    equipment: 'Peso corporal',
    sets: 3,
    reps: '40 s',
    weight: 0,
    color: 'peach',
  },
];
function restore<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}
function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* The demo remains usable in private browsing. */
  }
}
function forgetAnthropometryDrafts() {
  for (let index = sessionStorage.length - 1; index >= 0; index--) {
    const key = sessionStorage.key(index);
    if (key?.startsWith('forma.anthropometry.')) sessionStorage.removeItem(key);
  }
}
export const useStudio = defineStore('studio', () => {
  const mode = ref<'live' | 'demo'>(
    sessionStorage.getItem('forma.demo.mode') === 'on' ? 'demo' : 'live',
  );
  const isDemo = computed(() => mode.value === 'demo');
  const isLive = computed(() => !isDemo.value);
  const offlineMode = ref(false);
  const user = ref<CurrentUser | null>(null);
  const organizations = ref<OrganizationSummary[]>([]);
  const currentOrganization = ref<OrganizationSummary | null>(null);
  const students = ref<Student[]>([]);
  const brand = ref<Brand>({ name: 'Forma', accent: '#005ea8' });
  const theme = ref<'light' | 'dark'>('light');
  const subscription = ref<Subscription | null>(null);
  const portal = ref<StudentRecord | null>(null);
  const nextCursor = ref<string | null>(null);
  const contextLoading = ref(false);
  const contextError = ref('');
  const toast = ref('');
  const notice = ref(false);
  const selectedStudent = ref<Student | null>(null);
  const showInvite = ref(false);
  const invitation = ref<{ url: string; expiresAt: string; delivery: string } | null>(null);
  const session = ref<Record<string, { weight: number; reps: number }[]>>({});
  const completedSets = computed(() =>
    Object.values(session.value).reduce((n, sets) => n + sets.length, 0),
  );
  let initialized: Promise<void> | null = null;
  let generation = 0;
  const statusLabels: Record<StudentState, string> = {
    invited: 'Invitado',
    active: 'Activo',
    paused: 'Pausado',
    archived: 'Archivado',
  };
  function notify(message: string) {
    toast.value = message;
  }
  async function openStudent(id: string) {
    if (isDemo.value) {
      const student = students.value.find((s) => s.id === id);
      if (!student) throw new Error('Alumno no encontrado.');
      return student;
    }
    if (!currentOrganization.value) throw new Error('Selecciona un estudio.');
    const data = await apiRequest<{ student: StudentRecord }>(
      '/v1/organizations/' + currentOrganization.value.id + '/students/' + id,
    );
    return mapStudent(data.student);
  }
  function mapStudent(s: StudentRecord): Student {
    return {
      id: s.id,
      name: s.displayName,
      email: s.email,
      goal: s.goal,
      initials: s.displayName
        .trim()
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
      status: statusLabels[s.status],
      accessState: s.status,
      version: s.version,
      userId: s.userId,
      program: 'Sin programa asignado',
      completed: 0,
      total: 0,
      color: 'blue',
    };
  }
  function applyDemo() {
    const restored = restore<Student[]>('forma.demo.students', defaults);
    students.value = Array.isArray(restored) ? restored : defaults;
    brand.value = restore<Brand>('forma.demo.brand', { name: 'Nico Studio', accent: '#005ea8' });
    theme.value = restore<'light' | 'dark'>('forma.demo.theme', 'light');
    session.value = restore('forma.demo.session', {});
    currentOrganization.value = null;
    subscription.value = null;
    portal.value = null;
  }
  if (isDemo.value) applyDemo();
  async function initialize(force = false) {
    if (isDemo.value) return;
    if (force) initialized = null;
    if (!initialized)
      initialized = (async () => {
        try {
          if (localStorage.getItem('forma.logout.pending')) {
            await apiRequest('/v1/auth/logout', { method: 'POST' });
            localStorage.removeItem('forma.logout.pending');
            await forgetOfflineContext();
          }
          user.value = (await apiRequest<{ user: CurrentUser }>('/v1/auth/me')).user;
          const cachedIdentity = await readOfflineContext().catch(() => null);
          if (cachedIdentity && cachedIdentity.user.id !== user.value.id)
            await forgetOfflineContext();
          offlineMode.value = false;
          theme.value = user.value.theme;
          organizations.value = (
            await apiRequest<{ organizations: OrganizationSummary[] }>('/v1/organizations')
          ).organizations;
          const desired = sessionStorage.getItem('forma.organization');
          const choice =
            organizations.value.find((org) => org.id === desired) ?? organizations.value[0];
          if (choice) await selectOrganization(choice.id);
        } catch (error) {
          if (error instanceof ApiClientError && [401, 403].includes(error.status)) {
            user.value = null;
            organizations.value = [];
            clearContext();
            forgetAnthropometryDrafts();
            await forgetOfflineContext().catch(() => {});
          } else if (
            error instanceof ApiClientError &&
            error.status === 0 &&
            !localStorage.getItem('forma.logout.pending')
          ) {
            const cached = await readOfflineContext().catch(() => null);
            if (cached) {
              user.value = cached.user;
              organizations.value = [cached.org];
              currentOrganization.value = cached.org;
              brand.value = cached.brand;
              portal.value = cached.portal;
              offlineMode.value = true;
              theme.value = cached.user.theme;
              contextError.value = '';
            } else
              contextError.value = 'Conecta para verificar tu acceso y preparar un entrenamiento.';
          } else
            contextError.value =
              error instanceof Error ? error.message : 'No pudimos cargar el estudio.';
        }
      })();
    await initialized;
  }
  function clearContext() {
    generation++;
    showInvite.value = false;
    students.value = [];
    selectedStudent.value = null;
    invitation.value = null;
    subscription.value = null;
    portal.value = null;
    nextCursor.value = null;
    currentOrganization.value = null;
    brand.value = { name: 'Forma', accent: '#005ea8' };
  }
  async function selectOrganization(id: string) {
    const choice = organizations.value.find((org) => org.id === id);
    if (!choice) return;
    clearContext();
    const epoch = generation;
    currentOrganization.value = choice;
    sessionStorage.setItem('forma.organization', id);
    contextLoading.value = true;
    contextError.value = '';
    if (
      choice.status === 'suspended' ||
      (choice.role === 'student' && choice.studentStatus !== 'active')
    ) {
      contextLoading.value = false;
      brand.value = { name: choice.name, slug: choice.slug, accent: '#005ea8' };
      return;
    }
    try {
      const detail = await apiRequest<{ organization: OrganizationSummary; brand: Brand }>(
        `/v1/organizations/${id}`,
      );
      if (epoch !== generation) return;
      brand.value = detail.brand;
      if (choice.role === 'student') {
        const result = await apiRequest<{ student: StudentRecord | null }>(
          `/v1/organizations/${id}/portal`,
        );
        if (epoch === generation) portal.value = result.student;
      } else {
        const [learners, plan] = await Promise.all([
          apiRequest<{ students: StudentRecord[]; nextCursor: string | null }>(
            `/v1/organizations/${id}/students`,
          ),
          choice.role === 'owner'
            ? apiRequest<{ subscription: Subscription }>(`/v1/organizations/${id}/subscription`)
            : Promise.resolve(null),
        ]);
        if (epoch !== generation) return;
        students.value = learners.students.map(mapStudent);
        nextCursor.value = learners.nextCursor;
        subscription.value = plan?.subscription ?? null;
      }
    } catch (error) {
      if (epoch === generation)
        contextError.value =
          error instanceof Error ? error.message : 'No pudimos cargar el estudio.';
    } finally {
      if (epoch === generation) contextLoading.value = false;
    }
  }
  async function refresh() {
    if (!currentOrganization.value) return;
    await initialize(true);
  }
  async function refreshStudents() {
    const id = currentOrganization.value?.id;
    const epoch = generation;
    if (!id) return;
    const data = await apiRequest<{ students: StudentRecord[]; nextCursor: string | null }>(
      `/v1/organizations/${id}/students`,
    );
    if (epoch !== generation) return;
    students.value = data.students.map(mapStudent);
    nextCursor.value = data.nextCursor;
    if (currentOrganization.value?.role === 'owner') {
      const plan = await apiRequest<{ subscription: Subscription }>(
        `/v1/organizations/${id}/subscription`,
      );
      if (epoch === generation) subscription.value = plan.subscription;
    }
  }
  async function loadMoreStudents() {
    const id = currentOrganization.value?.id,
      cursor = nextCursor.value,
      epoch = generation;
    if (!id || !cursor) return;
    const data = await apiRequest<{ students: StudentRecord[]; nextCursor: string | null }>(
      `/v1/organizations/${id}/students?cursor=${cursor}`,
    );
    if (epoch !== generation) return;
    const existing = new Set(students.value.map((s) => s.id));
    students.value.push(...data.students.filter((s) => !existing.has(s.id)).map(mapStudent));
    nextCursor.value = data.nextCursor;
  }
  function enterDemo() {
    forgetAnthropometryDrafts();
    sessionStorage.setItem('forma.demo.mode', 'on');
    mode.value = 'demo';
    user.value = null;
    organizations.value = [];
    clearContext();
    applyDemo();
    initialized = null;
  }
  async function login(email: string, password: string, studioSlug?: string) {
    if (localStorage.getItem('forma.logout.pending')) {
      await apiRequest('/v1/auth/logout', { method: 'POST' });
      localStorage.removeItem('forma.logout.pending');
    }
    await apiRequest('/v1/auth/login', {
      method: 'POST',
      body: { email, password, ...(studioSlug ? { studioSlug } : {}) },
    });
    forgetAnthropometryDrafts();
    await forgetOfflineContext().catch(() => {});
    sessionStorage.removeItem('forma.demo.mode');
    mode.value = 'live';
    clearContext();
    await initialize(true);
    if (studioSlug) {
      const matching = organizations.value.find((org) => org.slug === studioSlug);
      if (matching) await selectOrganization(matching.id);
    }
  }
  async function afterRegistration(organizationId: string) {
    forgetAnthropometryDrafts();
    sessionStorage.removeItem('forma.demo.mode');
    mode.value = 'live';
    sessionStorage.setItem('forma.organization', organizationId);
    clearContext();
    await initialize(true);
  }
  async function logout() {
    const uid = user.value?.id;
    if (
      uid &&
      (await pendingForUser(uid)) &&
      !(await confirmAction(
        'Hay registros pendientes en este dispositivo. Cerrar sesión los borrará. Cancela para sincronizar o descargarlos antes. ¿Borrar y cerrar sesión?',
      ))
    )
      return false;
    if (isLive.value) {
      if (!navigator.onLine) {
        localStorage.setItem('forma.logout.pending', '1');
      } else await apiRequest('/v1/auth/logout', { method: 'POST' });
    }
    if (uid) await purgeWorkouts(uid);
    forgetAnthropometryDrafts();
    offlineMode.value = false;
    sessionStorage.removeItem('forma.demo.mode');
    sessionStorage.removeItem('forma.organization');
    mode.value = 'live';
    user.value = null;
    organizations.value = [];
    clearContext();
    session.value = {};
    initialized = null;
    return true;
  }
  window.addEventListener('forma:offline-logout', () => {
    stopWorkoutSync();
    forgetAnthropometryDrafts();
    user.value = null;
    organizations.value = [];
    clearContext();
    initialized = null;
    window.location.assign('/acceso');
  });
  async function publicBrand(slug: string) {
    brand.value = (await apiRequest<{ brand: Brand }>(`/v1/public/studios/${slug}`)).brand;
  }
  async function addStudent(name: string, email: string, goal: string) {
    if (isDemo.value) {
      const normalized = email.trim().toLowerCase();
      if (students.value.some((s) => s.email === normalized)) return false;
      students.value.unshift({
        id: crypto.randomUUID(),
        name: name.trim(),
        email: normalized,
        goal,
        initials: name
          .trim()
          .split(/\s+/)
          .map((part) => part[0])
          .slice(0, 2)
          .join('')
          .toUpperCase(),
        status: 'Sin actividad',
        color: 'blue',
        program: 'Sin programa asignado',
        completed: 0,
        total: 3,
      });
      persist('forma.demo.students', students.value);
      showInvite.value = false;
      notify('Alumno de ejemplo añadido a tu espacio.');
      return true;
    }
    const id = currentOrganization.value?.id;
    if (!id) throw new Error('Selecciona un estudio.');
    await apiRequest(`/v1/organizations/${id}/students`, {
      method: 'POST',
      body: { displayName: name, email, goal },
    });
    if (currentOrganization.value?.id === id) {
      await refreshStudents();
      showInvite.value = false;
      notify('Alumno creado. Ya puedes preparar su invitación.');
    }
    return true;
  }
  async function editStudent(id: string, displayName: string, goal: string, version: number) {
    const org = currentOrganization.value?.id;
    if (!org) return;
    const response = await apiRequest<{ student: StudentRecord }>(
      `/v1/organizations/${org}/students/${id}`,
      { method: 'PUT', body: { displayName, goal, version } },
    );
    if (currentOrganization.value?.id !== org) return;
    await refreshStudents();
    selectedStudent.value = mapStudent(response.student);
    notify('Ficha actualizada.');
  }
  async function changeStudentState(student: Student, status: StudentState, reason: string) {
    const org = currentOrganization.value?.id;
    if (!org) return;
    const response = await apiRequest<{ student: StudentRecord }>(
      `/v1/organizations/${org}/students/${student.id}/state`,
      { method: 'PATCH', body: { status, version: student.version, reason } },
    );
    if (currentOrganization.value?.id !== org) return;
    await refreshStudents();
    selectedStudent.value = mapStudent(response.student);
    notify('Acceso actualizado. El conteo del plan también se actualizó.');
  }
  async function createInvitation(student: Student) {
    const org = currentOrganization.value?.id;
    if (!org) return;
    const result = await apiRequest<{ url: string; expiresAt: string; delivery: string }>(
      `/v1/organizations/${org}/students/${student.id}/invitation`,
      { method: 'POST' },
    );
    if (currentOrganization.value?.id === org) invitation.value = result;
  }
  async function saveBrand(
    name: string,
    accent: string,
    details?: { welcomeMessage: string; biography: string; contactEmail: string | null },
  ) {
    if (isDemo.value) {
      brand.value = { ...brand.value, name: name.trim(), accent };
      persist('forma.demo.brand', brand.value);
      notify('Tu marca se actualizó en esta vista de ejemplo.');
      return;
    }
    const org = currentOrganization.value?.id;
    if (!org) return;
    await apiRequest(`/v1/organizations/${org}/branding`, {
      method: 'PUT',
      body: {
        name,
        accent,
        welcomeMessage: details?.welcomeMessage ?? brand.value.welcomeMessage ?? '',
        biography: details?.biography ?? brand.value.biography ?? '',
        contactEmail: details ? details.contactEmail : (brand.value.contactEmail ?? null),
      },
    });
    await refresh();
    notify('Tu marca ya está guardada en el estudio.');
  }
  async function uploadLogo(dataUrl: string) {
    const org = currentOrganization.value?.id;
    if (!org) return;
    await apiRequest(`/v1/organizations/${org}/branding/logo`, {
      method: 'POST',
      body: { dataUrl },
    });
    await refresh();
    notify('Logo actualizado.');
  }
  async function removeLogo() {
    const org = currentOrganization.value?.id;
    if (!org) return;
    await apiRequest(`/v1/organizations/${org}/branding/logo`, { method: 'DELETE' });
    await refresh();
    notify('Logo eliminado de la marca pública.');
  }
  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
    if (isDemo.value) persist('forma.demo.theme', theme.value);
    else if (user.value) {
      void apiRequest('/v1/auth/preferences', {
        method: 'PUT',
        body: { theme: theme.value },
      }).catch(() => notify('El tema cambió aquí, pero no pudimos guardarlo en tu cuenta.'));
    }
  }
  function saveSet(id: string, weight: number, reps: number) {
    if (isLive.value) return;
    session.value[id] = [...(session.value[id] ?? []), { weight, reps }];
    persist('forma.demo.session', session.value);
    notify('Serie de ejemplo guardada en este teléfono.');
  }
  function resetSession() {
    session.value = {};
    persist('forma.demo.session', {});
    notify('Sesión de ejemplo reiniciada.');
  }
  return {
    mode,
    isLive,
    offlineMode,
    isDemo,
    user,
    organizations,
    currentOrganization,
    subscription,
    portal,
    nextCursor,
    contextLoading,
    contextError,
    students,
    brand,
    theme,
    toast,
    notice,
    selectedStudent,
    openStudent,
    showInvite,
    invitation,
    session,
    completedSets,
    initialize,
    selectOrganization,
    refresh,
    refreshStudents,
    loadMoreStudents,
    enterDemo,
    login,
    logout,
    afterRegistration,
    publicBrand,
    notify,
    addStudent,
    editStudent,
    changeStudentState,
    createInvitation,
    saveBrand,
    uploadLogo,
    removeLogo,
    toggleTheme,
    saveSet,
    resetSession,
  };
});
