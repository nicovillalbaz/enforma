/* Focused, read-only check of licensed artwork in the local synthetic demo. */
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
const result = { cases: [], errors: [] };
page.on('pageerror', (error) => result.errors.push(error.message));
try {
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('coach.aurora@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill(config.password);
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await page.waitForURL((url) => url.pathname !== '/acceso');
  for (const name of [
    'Press de banca con barra',
    'Press de banca con mancuernas',
    'Press de pecho en máquina',
  ]) {
    await page.goto('/ejercicios');
    await page.getByRole('button', { name: `Abrir guía ${name}`, exact: true }).click();
    await page.locator('.exercise-art-frame').first().waitFor();
    await page
      .locator('.exercise-art-frame')
      .first()
      .evaluate((img) => img.decode());
    const data = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      frames: document.querySelectorAll('.exercise-art-frame').length,
      loaded: [...document.querySelectorAll('.exercise-art-frame')].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
      controls: [...document.querySelectorAll('button')].filter((button) =>
        /pausar|animar esquema/i.test(button.textContent ?? ''),
      ).length,
      animation: getComputedStyle(document.querySelector('.exercise-art-frame')).animationDuration,
    }));
    result.cases.push({ name, ...data });
    if (name === 'Press de pecho en máquina')
      await page.screenshot({ path: 'docs/evidencias/exercise-art-mobile.png' });
  }
} finally {
  await context.close();
  await browser.close();
  await writeFile(
    'docs/evidencias/exercise-art-review.json',
    JSON.stringify(result, null, 2) + '\n',
  );
}
console.info(
  JSON.stringify({
    cases: result.cases.length,
    errors: result.errors.length,
    failed: result.cases.filter(
      (entry) =>
        entry.scrollWidth > entry.width + 1 ||
        entry.frames !== 2 ||
        !entry.loaded ||
        entry.controls ||
        entry.animation !== '1.8s',
    ).length,
  }),
);
