/* Read-only check of the local synthetic exercise catalogue. */
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { demoConfig, demoOrigin } from '../../scripts/manual-demo-config.mjs';

const config = await demoConfig();
const browser = await chromium.launch({ headless: true, timeout: 15000 });
const context = await browser.newContext({
  baseURL: demoOrigin,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  serviceWorkers: 'block',
});
await context.addInitScript(() => sessionStorage.setItem('forma.install.continued', '1'));
const page = await context.newPage();
const report = { examples: [], errors: [], apiErrors: [] };
page.on('pageerror', (error) => report.errors.push(error.message));
page.on('response', (response) => {
  if (response.url().includes('/v1/') && response.status() >= 400)
    report.apiErrors.push({ path: new URL(response.url()).pathname, status: response.status() });
});
try {
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('coach.aurora@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill(config.password);
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await page.waitForURL((url) => url.pathname !== '/acceso');
  for (const name of [
    'Press de banca con barra',
    'Press de banca con mancuernas',
    'Sentadilla con barra',
    'Dominadas',
  ]) {
    await page.goto('/ejercicios');
    await page.getByRole('button', { name: `Abrir guía ${name}`, exact: true }).click();
    for (const width of [390, 1366]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
      const data = await page.evaluate(() => ({
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        visibleSymbols: [
          ...document.querySelectorAll('.exercise-pose-card .exercise-symbol'),
        ].filter((element) => element.getClientRects().length).length,
        animationControls: [...document.querySelectorAll('button')].filter((element) =>
          /animar esquema|pausar esquema/i.test(element.textContent ?? ''),
        ).length,
        headings: [...document.querySelectorAll('main h2')]
          .filter((element) => element.getClientRects().length)
          .map((element) => element.textContent?.trim())
          .slice(0, 3),
      }));
      report.examples.push({ name, width, ...data });
      if (width === 390 || name === 'Press de banca con barra')
        await page.screenshot({
          path: `docs/evidencias/symbol-${name.toLocaleLowerCase('es').replaceAll(/[^a-z0-9]+/g, '-')}-${width}.png`,
          fullPage: false,
        });
    }
  }
} finally {
  await context.close();
  await browser.close();
  await writeFile(
    'docs/evidencias/static-symbol-review.json',
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.info(
  JSON.stringify({
    checked: report.examples.length,
    errors: report.errors.length,
    apiErrors: report.apiErrors.length,
    overflow: report.examples.filter((e) => e.documentWidth > e.width + 1).length,
    missingPairs: report.examples.filter((e) => e.visibleSymbols !== 2).length,
    animationControls: report.examples.reduce((sum, e) => sum + e.animationControls, 0),
  }),
);
