import { approveBrowserCoach } from './coach-approval';
import { test, expect, type Page } from '@playwright/test';

test.use({ actionTimeout: 15000 });

async function continueInBrowser(page: Page) {
  const button = page.getByRole('button', { name: 'Continuar en el navegador' });
  if (await button.isVisible()) await button.click();
}

test('mobile coach and student can register, manage access and keep organizations separate', async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  const suffix = testInfo.project.name + '-' + Date.now().toString(36);
  const email = 'coach-' + suffix + '@example.test';
  const password = 'Browser-password-2026!';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/registro');
  await continueInBrowser(page);
  await page.getByLabel('Tu nombre completo').fill('Coach Navegador');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel(/^Contraseña/).fill(password);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByLabel('Nombre de tu estudio').fill('Estudio ' + suffix);
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Crear mi estudio', exact: true }).click();
  await expect(page).toHaveURL(/\/estado$/);

  const organizations = (await (await page.request.get('/v1/organizations')).json())
    .organizations as { id: string; status: string }[];
  const first = organizations.find((org) => org.status === 'suspended');
  expect(first).toBeDefined();
  await approveBrowserCoach(page.request, first!.id);
  await page.getByRole('button', { name: 'Comprobar de nuevo' }).click();
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible();

  await page.getByRole('button', { name: 'Abrir correo de desarrollo' }).click();
  await page.getByRole('link', { name: 'Abrir enlace de verificación' }).click();
  await page.getByRole('button', { name: 'Verificar mi correo' }).click();
  await page.getByRole('link', { name: 'Volver a mi estudio' }).click();

  await page.goto('/alumnos');
  await page.getByRole('button', { name: 'Nuevo alumno', exact: true }).click();
  await expect(page).toHaveURL(/\/alumnos\/nuevo$/);
  await page.getByLabel('Nombre completo', { exact: true }).fill('Alumno Navegador');
  await page
    .getByLabel('Correo electrónico', { exact: true })
    .fill('student-' + suffix + '@example.test');
  await page.getByRole('button', { name: 'Crear alumno', exact: true }).click();
  await expect(page).toHaveURL(/\/alumnos$/);
  await page.getByRole('link', { name: /Alumno Navegador/ }).click();
  await page.getByText('Invitación de acceso', { exact: true }).click();
  await page.getByRole('button', { name: 'Preparar invitación' }).click();
  const invitation = await page.getByLabel('Enlace privado de un solo uso').inputValue();
  expect(invitation).toContain('/invitar?token=');

  const studentContext = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const pupil = await studentContext.newPage();
    pupil.on('pageerror', (error) => errors.push(error.message));
    await pupil.goto(invitation);
    await pupil.getByLabel('Tu nombre', { exact: true }).fill('Alumno Navegador');
    await pupil.getByLabel('Tu objetivo principal').fill('Mejorar mi fuerza');
    await pupil.getByLabel('Tu contraseña').fill(password);
    await pupil.getByRole('checkbox').check();
    await pupil.getByRole('button', { name: 'Aceptar y entrar' }).click();
    await expect(pupil).toHaveURL(/\/alumno$/);
    await expect(pupil.getByRole('button', { name: 'Continuar en el navegador' })).toBeVisible();
    await continueInBrowser(pupil);
    await expect(pupil.getByRole('heading', { name: 'Hola, Alumno' })).toBeVisible();
    await pupil.goto('/alumnos');
    await expect(pupil).toHaveURL(/\/alumno$/);

    await page.reload();
    await page.getByText('Gestionar acceso', { exact: true }).click();
    await page.getByLabel('Nuevo estado').selectOption('paused');
    await page.getByLabel('Motivo del cambio').fill('Pausa solicitada en la prueba');
    await page.getByRole('button', { name: 'Actualizar acceso' }).click();
    await expect(page.locator('.status-badge')).toHaveText('Pausado');
    await pupil.reload();
    await expect(pupil).toHaveURL(/\/estado$/);
    await page.getByLabel('Nuevo estado').selectOption('active');
    await page.getByRole('button', { name: 'Actualizar acceso' }).click();
    await expect(page.locator('.status-badge')).toHaveText('Activo');
    await pupil.getByRole('button', { name: 'Comprobar de nuevo' }).click();
    await expect(pupil.getByRole('heading', { name: 'Hola, Alumno' })).toBeVisible();

    await page.goto('/marca');
    await page.getByLabel('Nombre de tu estudio').fill('Marca ' + suffix);
    await page.getByRole('button', { name: 'Guardar mi marca' }).click();
    await expect(page).toHaveTitle('Marca ' + suffix + ' · Forma');

    await page.goto('/crear-estudio');
    await page.getByLabel('Nombre de tu estudio').fill('Segundo ' + suffix);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('button', { name: 'Crear mi estudio', exact: true }).click();
    await expect(page).toHaveURL(/\/estado$/);
    const second = (
      (await (await page.request.get('/v1/organizations')).json()).organizations as {
        id: string;
        status: string;
      }[]
    ).find((org) => org.status === 'suspended');
    expect(second).toBeDefined();
    await approveBrowserCoach(page.request, second!.id);
    await page.getByRole('button', { name: 'Comprobar de nuevo' }).click();
    await page.goto('/alumnos');
    await expect(page.getByRole('link', { name: /Alumno Navegador/ })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Cambiar estudio en móvil' }).selectOption(first!.id);
    await page.goto('/alumnos');
    await expect(page.getByRole('link', { name: /Alumno Navegador/ })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await studentContext.close();
  }
});

test('public onboarding stays within narrow viewports and keeps browser zoom available', async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/registro',
      '/privacidad',
      '/condiciones',
      '/acceso',
      '/invitar',
      '/verificar',
    ]) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        path + ' ' + width,
      ).toBe(true);
      expect(await page.locator('meta[name=viewport]').getAttribute('content')).not.toMatch(
        /user-scalable=no|maximum-scale=1/,
      );
    }
  }
});
