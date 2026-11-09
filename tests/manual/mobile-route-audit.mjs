/* Read-only route sweep against the local synthetic demo. No business writes. */
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { demoConfig, demoOrigin } from '../../scripts/manual-demo-config.mjs';

const config = await demoConfig();
const browser = await chromium.launch({ headless: true, timeout: 15000 });
const report = { date: '2026-10-26', widths: [320, 390], pages: [], errors: [] };

async function session(email) {
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
  page.on('pageerror', (error) =>
    report.errors.push({ role: email, route: page.url(), kind: 'script', message: error.message }),
  );
  page.on('response', (response) => {
    if (response.status() === 404 && response.url().includes('/assets/'))
      report.errors.push({ role: email, route: page.url(), kind: 'asset', url: response.url() });
    if (
      response.url().includes('/v1/') &&
      response.status() >= 400 &&
      !response.url().endsWith('/auth/me')
    )
      report.errors.push({
        role: email,
        route: page.url(),
        kind: 'api',
        status: response.status(),
        url: response.url(),
      });
  });
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(config.password);
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await page.waitForURL((url) => url.pathname !== '/acceso');
  return { context, page };
}

async function inspect(page, role, target, widths = [390]) {
  await page.goto(target);
  await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    const data = await page.evaluate(() => {
      const main = document.querySelector('#main-content') ?? document.querySelector('main');
      const visible = (element) =>
        element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
      return {
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        heading:
          [...(main?.querySelectorAll('h1,h2') ?? [])]
            .filter(visible)
            .map((element) => element.textContent?.trim())
            .find(Boolean) ?? '',
        mainLength: main?.textContent?.trim().length ?? 0,
        alerts: [...document.querySelectorAll('[role="alert"]')]
          .filter(visible)
          .map((element) => element.textContent?.trim())
          .filter(Boolean),
        tinyActions: [...document.querySelectorAll('button,a,[role="button"]')]
          .filter(visible)
          .filter((element) => {
            const box = element.getBoundingClientRect();
            return box.width < 36 || box.height < 36;
          })
          .map((element) =>
            (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 40),
          )
          .slice(0, 8),
      };
    });
    report.pages.push({ role, target, actual: new URL(page.url()).pathname, width, ...data });
  }
}

try {
  const coach = await session('coach.aurora@example.test');
  const orgs = await (await coach.context.request.get('/v1/organizations')).json();
  const org = orgs.organizations.find((item) => item.role === 'owner');
  const students = await (
    await coach.context.request.get(`/v1/organizations/${org.id}/students`)
  ).json();
  const student = students.students.find((item) => /luna/i.test(item.displayName));
  if (!student) throw new Error('Synthetic student missing');
  const studentId = student.id;
  for (const route of [
    '/',
    '/alumnos',
    `/alumnos/${studentId}`,
    `/alumnos/${studentId}/exportar`,
    '/rutinas',
    '/ejercicios',
    '/alimentacion',
    `/progreso?studentId=${studentId}`,
    `/antropometria?studentId=${studentId}`,
    '/marca',
    '/plan',
    '/cuenta',
    '/mensualidades',
    '/mi-perfil',
    '/instalar',
    '/informacion',
  ])
    await inspect(
      coach.page,
      'coach',
      route,
      ['/alumnos', `/alumnos/${studentId}`, '/rutinas', '/alimentacion', '/ejercicios'].includes(
        route,
      )
        ? [320, 390]
        : [390],
    );
  await coach.context.close();

  const pupil = await session('alumno.luna@example.test');
  for (const route of [
    '/alumno',
    '/mi-programa',
    '/entrenar',
    '/historial',
    '/documentos',
    '/progreso',
    '/antropometria',
    '/alimentacion',
    '/biblioteca',
    '/mi-perfil',
    '/instalar',
  ])
    await inspect(
      pupil.page,
      'student',
      route,
      ['/alumno', '/entrenar', '/alimentacion'].includes(route) ? [320, 390] : [390],
    );
  await pupil.context.close();

  const admin = await session('admin.prueba@example.test');
  for (const route of ['/admin', '/admin/cuenta', '/mi-perfil'])
    await inspect(admin.page, 'admin', route);
  await admin.context.close();
} catch (error) {
  report.errors.push({
    kind: 'sweep',
    message: error instanceof Error ? error.message : String(error),
  });
} finally {
  await browser.close();
  await writeFile(
    'docs/evidencias/mobile-route-audit-2026-10-26.json',
    JSON.stringify(report, null, 2) + '\n',
  );
}
const overflow = report.pages.filter((page) => page.documentWidth > page.width + 1);
const empty = report.pages.filter((page) => page.mainLength < 30);
console.info(
  JSON.stringify({
    pages: report.pages.length,
    errors: report.errors.length,
    overflow: overflow.map(
      (item) => `${item.role}:${item.target}:${item.width}->${item.documentWidth}`,
    ),
    empty: empty.map((item) => `${item.role}:${item.target}`),
  }),
);
if (report.errors.length || overflow.length || empty.length) process.exitCode = 1;
