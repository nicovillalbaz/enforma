/* Read-only mobile check: common foods, editable recipe starting point and tenant isolation. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { demoConfig, demoOrigin } from '../../scripts/manual-demo-config.mjs';

const config = await demoConfig();
const browser = await chromium.launch({ headless: true, timeout: 15000 });
const errors = [];
async function coach(email) {
  const context = await browser.newContext({
    baseURL: demoOrigin,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  });
  await context.addInitScript(() => sessionStorage.setItem('forma.install.continued', '1'));
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(config.password);
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await page.waitForURL((url) => url.pathname !== '/acceso');
  const orgs = await (await context.request.get('/v1/organizations')).json();
  const org = orgs.organizations.find((item) => item.role === 'owner');
  assert(org);
  const response = await context.request.get(
    `/v1/organizations/${org.id}/nutrition?from=2026-10-20&to=2026-10-26&q=`,
  );
  assert.equal(response.status(), 200);
  const state = await response.json();
  return { context, page, state, organizationId: org.id };
}
let aurora, brisa;
try {
  aurora = await coach('coach.aurora@example.test');
  brisa = await coach('coach.brisa@example.test');
  const common = aurora.state.foods.filter(
    (item) => item.document.source === 'Catálogo Forma: solo nombres',
  );
  assert.equal(common.length, 80);
  assert(
    common.every((item) => Object.values(item.document.nutrients).every((value) => value === null)),
  );
  const aSalmon = aurora.state.foods.find((item) => item.document.name === 'Salmón cocido');
  const bSalmon = brisa.state.foods.find((item) => item.document.name === 'Salmón cocido');
  assert(aSalmon && bSalmon && aSalmon.id !== bSalmon.id);
  const csrf = await (await aurora.context.request.get('/v1/security/csrf')).json();
  const unverified = await aurora.context.request.put(
    `/v1/organizations/${aurora.organizationId}/nutrition/items/${crypto.randomUUID()}`,
    {
      headers: { 'X-CSRF-Token': csrf.token },
      data: {
        kind: 'food',
        revision: 0,
        archived: false,
        document: { ...aSalmon.document, nutrients: { ...aSalmon.document.nutrients, kcal: 100 } },
      },
    },
  );
  assert.equal(unverified.status(), 400);
  assert.equal((await unverified.json()).code, 'FOOD_SOURCE_REQUIRED');

  const page = aurora.page;
  await page.goto('/alimentacion');
  await page.getByRole('button', { name: 'Alimentos', exact: true }).click();
  await page.getByLabel('Buscar en el catálogo').fill('Salmón');
  await page.getByRole('heading', { name: 'Salmón cocido' }).waitFor();
  await page.getByRole('button', { name: 'Recetas', exact: true }).click();
  await page.getByRole('button', { name: 'Nueva receta' }).click();
  await page.getByLabel('Empezar con un plato conocido').selectOption('Ensalada rusa');
  assert.equal(await page.locator('.nutrition-ingredient').count(), 4);
  assert.equal(await page.getByLabel('Nombre', { exact: true }).inputValue(), 'Ensalada rusa');
  assert(
    (
      await page
        .locator('.nutrition-ingredient select')
        .evaluateAll((elements) => elements.map((element) => element.value))
    ).every(Boolean),
  );
  assert(
    (
      await page
        .locator('.nutrition-ingredient input')
        .evaluateAll((elements) => elements.map((element) => element.value))
    ).every((value) => value === ''),
  );
  await page.getByRole('button', { name: 'Añadir ingrediente' }).click();
  assert.equal(await page.locator('.nutrition-ingredient').count(), 5);
  await page.getByRole('button', { name: 'Quitar ingrediente 5' }).click();
  assert.equal(await page.locator('.nutrition-ingredient').count(), 4);
  await page.locator('.nutrition-ingredient input').first().fill('150');
  await page.locator('.nutrition-ingredient').first().scrollIntoViewIfNeeded();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.evaluate(() => ({
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      removeHeight: document
        .querySelector('.nutrition-ingredient > button')
        ?.getBoundingClientRect().height,
    }));
    assert(layout.documentWidth <= layout.viewport);
    assert(layout.removeHeight >= 44);
  }
  await page.screenshot({
    path: 'docs/evidencias/ensalada-rusa-editor-2026-10-26.png',
    fullPage: false,
  });
  assert.deepEqual(errors, []);
  console.info(
    '80 common foods per coach; no invented nutrients; recipe ingredients editable on mobile.',
  );
} finally {
  await aurora?.context.close();
  await brisa?.context.close();
  await browser.close();
}
