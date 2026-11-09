import { approveBrowserCoach } from './coach-approval';
import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { runMediaCommand } from '../../apps/worker/src/media.js';
test.use({ actionTimeout: 15000 });
test('coach builds a private guide with photo equipment and a real clip; student access and mobile layout', async ({
  page,
  request,
  browser,
  baseURL,
}, info) => {
  test.setTimeout(info.project.name === 'webkit' ? 240000 : 120000);
  const suffix = `${info.project.name}-${Date.now().toString(36)}`;
  const email = `library-${suffix}@example.test`;
  const password = 'Browser-library-2026!';
  const csrf = (await (await request.get('/v1/security/csrf')).json()).token;
  const headers = { 'x-csrf-token': csrf };
  const registered = await request.post('/v1/auth/register-coach', {
    headers,
    data: {
      fullName: 'Coach Biblioteca',
      email,
      password,
      name: 'Estudio Biblioteca',
      slug: `lib-${suffix}`,
      kind: 'coach',
      accent: '#005ea8',
      plan: 'basic',
      privacyAccepted: true,
    },
  });
  expect(registered.status()).toBe(201);
  const { organizationId } = await registered.json();
  await approveBrowserCoach(request, organizationId);
  const mail = (await (await request.get('/v1/development/emails')).json()).emails;
  const verification = new URL(
    mail.find((item: { kind: string }) => item.kind === 'email.verification').url,
  ).searchParams.get('token');
  expect(
    (await request.post('/v1/auth/verify-email', { headers, data: { token: verification } })).ok(),
  ).toBe(true);
  const student = (
    await (
      await request.post(`/v1/organizations/${organizationId}/students`, {
        headers,
        data: {
          displayName: 'Alumno Guías',
          email: `reader-${suffix}@example.test`,
          goal: 'Practicar técnica',
        },
      })
    ).json()
  ).student;
  const invitation = (
    await (
      await request.post(`/v1/organizations/${organizationId}/students/${student.id}/invitation`, {
        headers,
      })
    ).json()
  ).url;
  await mkdir('.local/e2e-media', { recursive: true });
  const clipPath = resolve(join('.local/e2e-media', `${suffix}.mp4`));
  await runMediaCommand(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=teal:s=320x240:r=10:d=2',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      clipPath,
    ],
    15000,
  );
  const image = await sharp({
    create: { width: 320, height: 240, channels: 3, background: '#d9e7fa' },
  })
    .png()
    .toBuffer();
  const failures: string[] = [];
  page.on('pageerror', (e) => failures.push(e.message));
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/ejercicios');
  await expect(page.getByRole('heading', { name: 'Tu biblioteca, tu manera.' })).toBeVisible();
  await page.getByRole('button', { name: 'Equipos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo equipo', exact: true }).click();
  await page.getByLabel('Nombre del equipo').fill('Polea Navegador');
  await page.getByLabel('Ubicación', { exact: true }).fill('Sala de fuerza');
  await page.getByLabel('Descripción', { exact: true }).fill('Equipo de demostración privada');
  await page
    .getByLabel('Subir foto', { exact: true })
    .setInputFiles({ name: 'polea.png', mimeType: 'image/png', buffer: image });
  await expect(page.getByText('Archivo recibido. Su procesamiento está en cola.')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar equipo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Polea Navegador', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ejercicios', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo ejercicio', exact: true }).click();
  const name = `Remo privado ${info.project.name}`;
  const instructions =
    'Apoya los pies con firmeza. Lleva el agarre hacia el tronco y vuelve con control. Sigue las indicaciones de tu coach.';
  await page.getByLabel('Nombre del ejercicio').fill(name);
  await page.getByLabel('Instrucciones', { exact: true }).fill(instructions);
  await page.getByLabel('Grupo muscular', { exact: true }).selectOption('Espalda');
  await page
    .getByLabel('Equipo de mi estudio', { exact: true })
    .selectOption({ label: 'Polea Navegador · Sala de fuerza' });
  await page
    .getByRole('dialog')
    .getByLabel('Estado del ejercicio', { exact: true })
    .selectOption('published');
  await page.getByLabel('Subir medio', { exact: true }).setInputFiles(clipPath);
  await expect(page.getByText('Archivo recibido. Su procesamiento está en cola.')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar ejercicio', exact: true }).click();
  const card = page
    .locator('.library-exercise-card')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await expect(card).toBeVisible();
  await expect(card.locator('.library-cover-state')).toHaveText(/Listo/, { timeout: 30000 });
  await expect(card).toContainText('Polea Navegador');
  const exercise = (
    await (await request.get(`/v1/organizations/${organizationId}/exercises?origin=own`)).json()
  ).exercises[0];
  expect(exercise.media.state).toBe('ready');
  const studentContext = await browser.newContext({
    baseURL,
    viewport: page.viewportSize()!,
    isMobile: info.project.name !== 'desktop',
    hasTouch: info.project.name !== 'desktop',
    userAgent: info.project.use.userAgent,
  });
  try {
    const pupil = await studentContext.newPage();
    const studentCsrf = (await (await studentContext.request.get('/v1/security/csrf')).json())
      .token;
    expect(
      (
        await studentContext.request.post('/v1/invitations/accept', {
          headers: { 'x-csrf-token': studentCsrf },
          data: {
            token: new URL(invitation).searchParams.get('token'),
            fullName: 'Alumno Guías',
            goal: 'Practicar técnica',
            password,
            privacyAccepted: true,
          },
        })
      ).ok(),
    ).toBe(true);
    await pupil.goto('/biblioteca');
    await expect(pupil.getByRole('heading', { name, exact: true })).toHaveCount(0);
    await card.getByRole('button', { name: 'Abrir guía', exact: true }).click();
    await expect(page.locator('dialog video')).toBeVisible();
    await page.getByRole('button', { name: 'Actualizar alumnos' }).click();
    await page.locator('dialog').getByLabel('Alumno', { exact: true }).selectOption(student.id);
    await page.getByRole('button', { name: 'Compartir guía', exact: true }).click();
    await expect(page.locator('.library-shared-list')).toContainText('Alumno Guías');
    await pupil.reload();
    const windowsWebKit = info.project.name === 'webkit' && process.platform === 'win32';
    const authenticatedFallback = windowsWebKit
      ? pupil.waitForResponse(
          (r) =>
            r.url().includes(`/media/${exercise.media.id}/file?`) &&
            !r.url().includes('variant=') &&
            r.request().resourceType() === 'fetch',
        )
      : null;
    await pupil.getByRole('button', { name: `Abrir guía ${name}`, exact: true }).click();
    await expect(pupil.locator('dialog .library-instructions')).toContainText(instructions);
    if (windowsWebKit) {
      expect((await authenticatedFallback!).status()).toBe(200);
      await expect(pupil.getByText('No pudimos cargar el medio.', { exact: true })).toBeVisible();
      info.annotations.push({
        type: 'platform-limitation',
        description:
          'WebKit Windows omits cookies in native media requests and rejects Blob MP4. Authenticated fetch and text fallback verified; real Safari playback remains a device gate.',
      });
    } else {
      await expect(pupil.locator('dialog video')).toHaveAttribute(
        'src',
        /^(\/v1\/organizations\/|blob:)/,
      );
      const video = pupil.locator('dialog video');
      await expect
        .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 15000 })
        .toBeGreaterThan(0);
    }
    await pupil.getByRole('button', { name: 'Cerrar guía' }).click();
    await pupil.route('**/media/*/file*', (route) => route.abort());
    await pupil.getByRole('button', { name: `Abrir guía ${name}`, exact: true }).click();
    await expect(pupil.getByText('No pudimos cargar el medio.', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(pupil.locator('.library-instructions')).toContainText(instructions);
    await page.getByRole('button', { name: 'Retirar acceso' }).click();
    await pupil.getByRole('button', { name: 'Cerrar guía' }).click();
    await pupil.reload();
    await expect(pupil.getByRole('heading', { name, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Cerrar guía' }).click();
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const tab of ['Ejercicios', 'Equipos', 'Medios']) {
        await page.getByRole('button', { name: tab, exact: true }).click();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${tab} ${width}`,
        ).toBe(true);
      }
    }
    await page.getByRole('button', { name: 'Ejercicios', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Buscar en biblioteca' }).fill(name);
    await expect(page.locator('.library-exercise-card')).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    expect(failures).toEqual([]);

    expect((await readFile(clipPath)).length).toBeGreaterThan(0);
    const canary = resolve(`.local/private-${suffix}.txt`);
    await writeFile(canary, 'Private test fixture');
    expect((await request.get('/@fs/' + canary.replaceAll('\\', '/'))).status()).toBe(403);
  } finally {
    await studentContext.close();
  }
});
