import { ref, watchEffect } from 'vue';
import type { useStudio } from './stores/studio';
import { router } from './router';
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export const installPrompt = ref<InstallPrompt>(),
  updateWaiting = ref(false),
  installed = ref(false),
  pwaError = ref('');
let registration: ServiceWorkerRegistration | undefined;
export function initializePwa(studio: ReturnType<typeof useStudio>) {
  const display = matchMedia('(display-mode: standalone)');
  installed.value = display.matches;
  display.addEventListener('change', (e) => {
    installed.value = e.matches;
  });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt.value = e as InstallPrompt;
  });
  window.addEventListener('appinstalled', () => {
    installed.value = true;
    installPrompt.value = undefined;
  });
  watchEffect(() => {
    const route = router.currentRoute.value,
      explicit =
        (route.path.startsWith('/estudio/') || route.path.startsWith('/abrir/')) &&
        typeof route.params.slug === 'string'
          ? route.params.slug
          : undefined;
    const slug =
      explicit ??
      (studio.isDemo ? undefined : (studio.currentOrganization?.slug ?? studio.brand.slug));
    const base = slug ? `/v1/public/studios/${encodeURIComponent(slug)}` : undefined;
    for (const [rel, id, href] of [
      [
        'manifest',
        'forma-manifest',
        base ? base + '/manifest.webmanifest' : '/manifest.webmanifest',
      ],
      [
        'apple-touch-icon',
        'forma-apple-icon',
        base ? base + '/app-icon.png?size=180' : '/app-icon-192.png',
      ],
    ]) {
      let link = document.getElementById(id!) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.id = id!;
        link.rel = rel!;
        document.head.append(link);
      }
      link.href = href!;
    }
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (theme) theme.content = studio.brand.accent;
  });
  if (import.meta.env.PROD && 'serviceWorker' in navigator)
    window.addEventListener('load', () => {
      void navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          registration = reg;
          updateWaiting.value = Boolean(reg.waiting);
          reg.addEventListener('updatefound', () => {
            reg.installing?.addEventListener('statechange', () => {
              updateWaiting.value = Boolean(reg.waiting);
            });
          });
        })
        .catch(() => {
          pwaError.value =
            'No pudimos preparar el acceso sin conexión. Comprueba tu conexión y vuelve a abrir la app.';
        });
    });
}
export async function requestInstall() {
  pwaError.value = '';
  const event = installPrompt.value;
  if (!event) return;
  try {
    await event.prompt();
    await event.userChoice;
  } catch {
    pwaError.value = 'El navegador no pudo abrir la instalación. Usa su menú para añadir la app.';
  } finally {
    installPrompt.value = undefined;
  }
}
export async function checkUpdate() {
  pwaError.value = '';
  try {
    if (!registration) {
      pwaError.value =
        'No hay una instalación preparada en este acceso. Usa el enlace seguro de tu estudio y vuelve a intentarlo.';
      return;
    }
    await registration.update();
    updateWaiting.value = Boolean(registration.waiting);
  } catch {
    pwaError.value = 'No pudimos comprobar actualizaciones. Inténtalo con conexión.';
  }
}
