/* Read-only visual check after the UX code sweep. Uses synthetic local accounts. */
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { demoConfig, demoOrigin } from '../../scripts/manual-demo-config.mjs';

const config = await demoConfig();
const browser = await chromium.launch({ headless: true, timeout: 15000 });
const report = { routes: [], errors: [], apiErrors: [] };
const targets = [
  { role: 'coach', email: 'coach.aurora@example.test', route: '/rutinas' },
  { role: 'coach', email: 'coach.aurora@example.test', route: '/alimentacion' },
  { role: 'student', email: 'alumno.luna@example.test', route: '/alumno' },
  { role: 'admin', email: 'admin.prueba@example.test', route: '/admin' },
];
let context;
try {
  for (const [index, target] of targets.entries()) {
    if (index === 0 || target.email !== targets[index - 1].email) {
      await context?.close();
      context = await browser.newContext({
        baseURL: demoOrigin,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        serviceWorkers: 'block',
      });
      await context.addInitScript(() => sessionStorage.setItem('forma.install.continued', '1'));
      const login = await context.newPage();
      await login.goto('/acceso');
      await login.getByLabel('Correo electrónico', { exact: true }).fill(target.email);
      await login.getByLabel('Contraseña', { exact: true }).fill(config.password);
      await login.getByRole('button', { name: 'Entrar a mi espacio' }).click();
      await login.waitForURL((url) => url.pathname !== '/acceso');
      await login.close();
    }
    const page = await context.newPage();
    page.on('pageerror', (e) => report.errors.push({ role: target.role, message: e.message }));
    page.on('response', (r) => {
      if (r.url().includes('/v1/') && r.status() >= 400)
        report.apiErrors.push({
          role: target.role,
          path: new URL(r.url()).pathname,
          status: r.status(),
        });
    });
    await page.goto(target.route);
    await page.waitForLoadState('networkidle', { timeout: 3500 }).catch(() => {});
    for (const width of [320, 390, 1366]) {
      await page.setViewportSize({ width, height: width === 1366 ? 768 : 844 });
      const metrics = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        headings: [...document.querySelectorAll('main h1, main h2')]
          .filter((e) => e.getClientRects().length)
          .map((e) => e.textContent?.trim())
          .slice(0, 5),
        smallTargets: [...document.querySelectorAll('button,a,[role=button]')]
          .filter(
            (e) =>
              e.getClientRects().length &&
              (e.getBoundingClientRect().width < 40 || e.getBoundingClientRect().height < 40),
          )
          .map((e) => e.getAttribute('aria-label') || e.textContent?.trim())
          .slice(0, 8),
      }));
      report.routes.push({ role: target.role, route: target.route, width, ...metrics });
      if (width === 390 || width === 1366)
        await page.screenshot({
          path: `docs/evidencias/ux-final-${target.role}-${target.route.slice(1)}-${width}.png`,
          fullPage: false,
        });
    }
    await page.close();
  }
} finally {
  await context?.close();
  await browser.close();
  await writeFile('docs/evidencias/ux-spot-check.json', JSON.stringify(report, null, 2) + '\n');
}
console.info(
  JSON.stringify({
    routes: report.routes.length,
    errors: report.errors.length,
    apiErrors: report.apiErrors.length,
    overflow: report.routes
      .filter((r) => r.documentWidth > r.width + 1)
      .map((r) => `${r.role}:${r.route}:${r.width}->${r.documentWidth}`),
    smallTargets: report.routes
      .filter((r) => r.width <= 390 && r.smallTargets.length)
      .map((r) => `${r.role}:${r.route}:${r.width}:${r.smallTargets.join(',')}`),
  }),
);
