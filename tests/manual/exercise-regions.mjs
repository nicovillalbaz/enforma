/* Small read-only check of region metadata in the local synthetic catalogue. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { demoConfig, demoOrigin } from '../../scripts/manual-demo-config.mjs';

const config = await demoConfig();
const browser = await chromium.launch({ headless: true, timeout: 15000 });
const context = await browser.newContext({
  baseURL: demoOrigin,
  viewport: { width: 390, height: 844 },
  serviceWorkers: 'block',
});
await context.addInitScript(() => sessionStorage.setItem('forma.install.continued', '1'));
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('coach.aurora@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill(config.password);
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await page.waitForURL((url) => url.pathname !== '/acceso');
  const orgs = await (await context.request.get('/v1/organizations')).json();
  const org = orgs.organizations.find((item) => item.role === 'owner');
  assert(org);
  const response = await context.request.get(
    `/v1/organizations/${org.id}/exercises?origin=global&limit=60`,
  );
  assert.equal(response.status(), 200);
  const { exercises } = await response.json();
  assert.equal(exercises.length, 56);
  assert(exercises.every((item) => item.instructions.includes('Zonas trabajadas:')));
  assert(exercises.every((item) => item.tags.length >= 2 && item.tags[0] !== 'Referencia visual'));
  const press = exercises.find((item) => item.name === 'Press de banca con barra');
  assert.deepEqual(press?.tags.slice(0, 2), ['Pecho', 'Tríceps']);
  await page.goto('/ejercicios');
  await page
    .getByRole('button', { name: 'Abrir guía Press de banca con barra', exact: true })
    .click();
  const description = page.locator('.library-instructions p').first();
  await description.waitFor();
  assert.match(await description.textContent(), /Zonas trabajadas: pectorales/);
  await page.goto('/ejercicios');
  await page.getByLabel('Filtrar por grupo muscular').selectOption('Cardio');
  await page.waitForFunction(
    () => document.querySelectorAll('.library-exercise-card').length === 4,
  );
  const cardio = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    images: [...document.querySelectorAll('.library-exercise-card .exercise-art-cover')].map(
      (img) => ({
        path: new URL(img.src).pathname,
        loaded: img.complete && img.naturalWidth > 0,
      }),
    ),
  }));
  assert(cardio.width <= 390);
  assert.equal(cardio.images.length, 4);
  assert(cardio.images.every((item) => item.loaded));
  assert(cardio.images.some((item) => item.path === '/exercise-art/elliptical/frame-2.svg'));
  await page.screenshot({
    path: 'docs/evidencias/cardio-art-mobile-2026-10-26.png',
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.info(
    '56 base exercises have regions and tags; press guide and four cardio cards render on mobile.',
  );
} finally {
  await context.close();
  await browser.close();
}
