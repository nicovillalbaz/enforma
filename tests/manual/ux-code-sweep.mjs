/* Read-only UI inventory across the active synthetic demo. No business writes. */
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { demoConfig, demoOrigin } from '../../scripts/manual-demo-config.mjs';

const config = await demoConfig();
const report = {
  date: '2026-10-26',
  scope: 'coach-student-admin-public',
  businessWrites: 0,
  pages: [],
  pageErrors: [],
  apiErrors: [],
  screenshots: [],
};
const browser = await chromium.launch({ headless: true, timeout: 15000 });
async function login(email) {
  const context = await browser.newContext({
    baseURL: demoOrigin,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  });
  await context.addInitScript(() => sessionStorage.setItem('forma.install.continued', '1'));
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) =>
    report.pageErrors.push({ email, route: page.url(), message: e.message }),
  );
  page.on('response', (r) => {
    if (r.url().includes('/v1/') && r.status() >= 400)
      report.apiErrors.push({
        email,
        route: page.url(),
        request: new URL(r.url()).pathname,
        status: r.status(),
      });
  });
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(config.password);
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await page.waitForURL((url) => url.pathname !== '/acceso');
  return { context, page };
}
async function inspect(page, role, target, widths, screenshot = false) {
  await page.goto(target);
  await page.waitForLoadState('networkidle', { timeout: 3500 }).catch(() => {});
  for (const width of widths) {
    await page.setViewportSize({ width, height: width >= 1000 ? 768 : 844 });
    const data = await page.evaluate(() => {
      const main = document.querySelector('#main-content') ?? document.querySelector('main');
      const visible = (e) =>
        !!e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
      const smallTargets = [...document.querySelectorAll('button,a,[role=button]')]
        .filter(visible)
        .filter((e) => {
          const box = e.getBoundingClientRect();
          return box.width < 40 || box.height < 40;
        })
        .slice(0, 12)
        .map((e) => ({
          text: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 45),
          className: String(e.className).slice(0, 70),
        }));
      const largeGaps = [...(main?.querySelectorAll('section,article,.ui-card') ?? [])]
        .filter(visible)
        .filter(
          (e) => e.getBoundingClientRect().height > 450 && (e.textContent?.trim().length ?? 0) < 80,
        )
        .slice(0, 5)
        .map((e) => ({
          className: String(e.className).slice(0, 70),
          height: Math.round(e.getBoundingClientRect().height),
        }));
      return {
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        headings: [...(main?.querySelectorAll('h1,h2') ?? [])]
          .filter(visible)
          .map((e) => e.textContent?.trim().slice(0, 75))
          .slice(0, 12),
        mainTextLength: main?.textContent?.trim().length ?? 0,
        smallTargets,
        largeGaps,
        alerts: [...document.querySelectorAll('[role=alert]')]
          .filter(visible)
          .map((e) => e.textContent?.trim().slice(0, 100)),
      };
    });
    report.pages.push({ role, target, actual: new URL(page.url()).pathname, width, ...data });
    if (screenshot && width === 390) {
      const file = `docs/evidencias/ux-${role}-${target
        .replaceAll(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)}.png`;
      await page.screenshot({ path: file, fullPage: false });
      report.screenshots.push(file);
    }
  }
}
let coach, student, admin;
try {
  coach = await login('coach.aurora@example.test');
  const orgs = await (await coach.context.request.get('/v1/organizations')).json();
  const org = orgs.organizations.find((o) => o.role === 'owner');
  const pupils = await (
    await coach.context.request.get(`/v1/organizations/${org.id}/students`)
  ).json();
  const luna = pupils.students.find((p) => /luna/i.test(p.displayName));
  if (!luna) throw new Error('Synthetic student missing');
  const coachRoutes = [
    '/',
    '/alumnos',
    `/alumnos/${luna.id}`,
    '/rutinas',
    '/ejercicios',
    '/alimentacion',
    `/progreso?studentId=${luna.id}`,
    `/antropometria?studentId=${luna.id}`,
    `/alumnos/${luna.id}/exportar`,
    '/marca',
    '/cuenta',
    '/mensualidades',
    '/mi-perfil',
  ];
  for (const route of coachRoutes)
    await inspect(
      coach.page,
      'coach',
      route,
      [390, ...(route === `/alumnos/${luna.id}` || route === '/rutinas' ? [320, 1366] : [])],
      route === `/alumnos/${luna.id}` || route === '/rutinas' || route === '/alimentacion',
    );
  student = await login('alumno.luna@example.test');
  for (const route of [
    '/alumno',
    '/entrenar',
    '/alimentacion',
    '/historial',
    '/documentos',
    '/antropometria',
    '/mi-perfil',
  ])
    await inspect(
      student.page,
      'student',
      route,
      [390, ...(route === '/alumno' ? [320, 1366] : [])],
      route === '/alumno' || route === '/historial',
    );
  admin = await login('admin.prueba@example.test');
  await inspect(admin.page, 'admin', '/admin', [390, 1366], true);
  const publicContext = await browser.newContext({
    baseURL: demoOrigin,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  });
  const publicPage = await publicContext.newPage();
  publicPage.on('pageerror', (e) =>
    report.pageErrors.push({ email: 'public', route: publicPage.url(), message: e.message }),
  );
  for (const route of ['/acceso', '/registro', '/recuperar', '/privacidad'])
    await inspect(publicPage, 'public', route, [390]);
  await publicContext.close();
  report.status = 'completed';
} catch (error) {
  report.status = 'failed';
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await coach?.context.close();
  await student?.context.close();
  await admin?.context.close();
  await browser.close();
  await writeFile('docs/evidencias/ux-code-sweep.json', JSON.stringify(report, null, 2) + '\n');
  console.info(
    JSON.stringify({
      status: report.status,
      pages: report.pages.length,
      errors: report.pageErrors.length,
      apiErrors: report.apiErrors.length,
      overflow: report.pages
        .filter((p) => p.documentWidth > p.width + 1)
        .map((p) => `${p.role}:${p.target}:${p.width}->${p.documentWidth}`),
      error: report.error,
    }),
  );
}
