import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/demo');
});
test('mobile and desktop routes remain within the viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/',
      '/alumnos',
      '/rutinas',
      '/ejercicios',
      '/marca',
      '/sistema',
      '/alumno',
      '/alumno/entrenar',
      '/acceso',
    ]) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `${path} at ${width}px`,
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
test('adds a demo student and filters the collection', async ({ page }) => {
  await page.goto('/alumnos');
  await page.getByRole('button', { name: 'Nuevo alumno' }).click();
  await page.getByLabel('Nombre completo').fill('Sofía Prueba');
  await page.getByLabel('Correo electrónico').fill('sofia@example.test');
  await page.getByRole('button', { name: 'Añadir alumno de ejemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Sofía Prueba' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar' }).fill('Sofía');
  await expect(page.locator('.student-card-grid .ui-card')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sofía Prueba' })).toBeVisible();
});
test('updates white label and saves an example workout locally', async ({ page }) => {
  await page.goto('/marca');
  await page.getByLabel('Nombre de tu estudio').fill('Estudio Prueba');
  await page.getByRole('button', { name: 'Cian energía' }).click();
  await page.getByRole('button', { name: 'Guardar mi marca' }).click();
  await expect(page).toHaveTitle('Estudio Prueba · Forma');
  await page.goto('/alumno/entrenar');
  await page.getByLabel('Peso (kg)').fill('65');
  await page.getByLabel('Repeticiones').fill('9');
  await page.getByRole('button', { name: 'Guardar serie de ejemplo' }).click();
  await expect(page.locator('.saved-sets')).toContainText('65 kg × 9 reps');
  await page.reload();
  await expect(page.locator('.saved-sets')).toContainText('65 kg × 9 reps');
});
