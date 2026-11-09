/* Read-only check of the three links reported from a synthetic student record. */
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
const missingAssets = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  if (response.status() === 404 && response.url().includes('/assets/'))
    missingAssets.push(response.url());
});
try {
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('coach.aurora@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill(config.password);
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await page.waitForURL((url) => url.pathname !== '/acceso');
  const orgs = await (await context.request.get('/v1/organizations')).json();
  const org = orgs.organizations.find((item) => item.role === 'owner');
  assert(org);
  const pupils = await (await context.request.get(`/v1/organizations/${org.id}/students`)).json();
  const student = pupils.students.find((item) => item.email === 'alumno.pausa@example.test');
  assert(student);
  const record = `/alumnos/${student.id}`;
  for (const [label, pathname] of [
    ['Alimentación', '/alimentacion'],
    ['Medidas básicas y progreso', '/progreso'],
    ['Exportar PDF o Excel', `${record}/exportar`],
  ]) {
    await page.goto(record);
    await page.getByRole('link', { name: label, exact: true }).click();
    await page.waitForURL((url) => url.pathname === pathname);
    await page.getByRole('main').waitFor();
    assert.equal(new URL(page.url()).pathname, pathname);
    console.info(`Opened ${label}: ${pathname}`);
  }
  assert.deepEqual(missingAssets, []);
  assert.deepEqual(errors, []);
  const oldChunk = await context.request.get('/assets/NutritionView-DpwnfeAB.js');
  assert.equal(oldChunk.status(), 200, 'Previous-build chunk should remain for open tabs');
  console.info('Three routes and previous-build chunk verified.');
} finally {
  await context.close();
  await browser.close();
}
