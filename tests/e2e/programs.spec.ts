import { approveBrowserCoach } from './coach-approval';
import { test, expect } from '@playwright/test';
import type { ProgramVersion, ProgramAssignment } from '@forma/shared';
test.use({ actionTimeout: 15000 });
test('coach publishes eight weeks to two pupils, v2 preserves v1 and the mobile builder stays within its viewport', async ({
  page,
  request,
  browser,
  baseURL,
}, info) => {
  test.setTimeout(info.project.name === 'webkit' ? 300000 : 180000);
  const suffix = `${info.project.name}-${Date.now().toString(36)}`,
    email = `program-${suffix}@example.test`,
    password = 'Browser-programs-2026!',
    name = `Programa ocho semanas ${info.project.name}`;
  const csrf = (await (await request.get('/v1/security/csrf')).json()).token,
    headers = { 'x-csrf-token': csrf };
  const registered = await request.post('/v1/auth/register-coach', {
    headers,
    data: {
      fullName: 'Coach Programas',
      email,
      password,
      name: 'Estudio Programas',
      slug: `plan-${suffix}`,
      kind: 'coach',
      accent: '#005ea8',
      plan: 'basic',
      privacyAccepted: true,
    },
  });
  expect(registered.status()).toBe(201);
  const { organizationId } = await registered.json(),
    root = `/v1/organizations/${organizationId}`;
  await approveBrowserCoach(request, organizationId);
  const mail = (await (await request.get('/v1/development/emails')).json()).emails;
  const token = new URL(
    mail.find((x: { kind: string }) => x.kind === 'email.verification').url,
  ).searchParams.get('token');
  expect((await request.post('/v1/auth/verify-email', { headers, data: { token } })).ok()).toBe(
    true,
  );
  const studentContexts = [];
  const students = [];
  try {
    for (const label of ['Uno', 'Dos']) {
      const student = (
        await (
          await request.post(root + '/students', {
            headers,
            data: {
              displayName: `Alumno ${label}`,
              email: `pupil-${label.toLowerCase()}-${suffix}@example.test`,
              goal: 'Construir fuerza',
            },
          })
        ).json()
      ).student;
      const invitationResponse = await request.post(root + `/students/${student.id}/invitation`, {
        headers,
      });
      expect(invitationResponse.status(), await invitationResponse.text()).toBe(200);
      const invitation = (await invitationResponse.json()).url;
      const context = await browser.newContext({
        baseURL,
        viewport: page.viewportSize()!,
        hasTouch: info.project.name !== 'desktop',
        isMobile: info.project.name !== 'desktop',
        userAgent: info.project.use.userAgent,
      });
      studentContexts.push(context);
      const studentCsrf = (await (await context.request.get('/v1/security/csrf')).json()).token;
      const accepted = await context.request.post('/v1/invitations/accept', {
        headers: { 'x-csrf-token': studentCsrf },
        data: {
          token: new URL(invitation).searchParams.get('token'),
          fullName: `Alumno ${label}`,
          goal: 'Construir fuerza',
          password,
          privacyAccepted: true,
        },
      });
      expect(accepted.ok()).toBe(true);
      students.push(student);
    }
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/acceso');
    await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
    await page.getByLabel(/^Contraseña/).fill(password);
    await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/rutinas');
    await page.getByRole('button', { name: 'Nuevo programa', exact: true }).click();
    await page.getByLabel('Nombre del programa', { exact: true }).fill(name);
    await page
      .getByLabel('Objetivo y descripción')
      .fill('Ocho semanas para construir una base sólida con técnica y constancia.');
    await page.getByRole('checkbox', { name: 'Guardar como plantilla reutilizable' }).check();
    async function stage(label: string) {
      const button = page.getByRole('button', { name: label, exact: true });
      if (await button.isVisible()) await button.click();
    }
    await stage('2. Ejercicios');
    await page.getByRole('button', { name: 'Añadir ejercicio', exact: true }).click();
    await page.getByRole('button', { name: 'Añadir Sentadilla a una silla', exact: true }).click();
    await page.getByLabel('Serie 1 carga', { exact: true }).fill('45');
    await stage('1. Estructura');
    for (let i = 0; i < 7; i++)
      await page.getByRole('button', { name: 'Duplicar semana', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
    await expect(page.locator('.program-editor .status-badge')).toBeVisible();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const step of ['1. Estructura', '2. Ejercicios', '3. Revisar']) {
        await stage(step);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `builder ${width} ${step}`,
        ).toBe(true);
      }
      expect(await page.locator('meta[name=viewport]').getAttribute('content')).not.toMatch(
        /user-scalable=no|maximum-scale=1/,
      );
    }
    await page.getByRole('button', { name: 'Vista previa alumno', exact: true }).click();
    await expect(
      page.getByRole('dialog').getByRole('heading', { name, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('dialog').getByText('45 kg', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar vista previa' }).click();
    await page.getByRole('button', { name: 'Publicar versión', exact: true }).click();
    await expect(page.getByText('Versión 1 publicada.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Volver a programas', exact: true }).click();
    const card = page
      .locator('.program-card')
      .filter({ has: page.getByRole('heading', { name, exact: true }) });
    await expect(card).toContainText('1 VERSIONES PUBLICADAS');
    await card.getByRole('button', { name: 'Versiones y asignar', exact: true }).click();
    await page.getByRole('checkbox', { name: /Alumno Uno/ }).check();
    await page.getByRole('checkbox', { name: /Alumno Dos/ }).check();
    await page.getByRole('button', { name: 'Asignar versión a 2 alumno(s)', exact: true }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.locator('.program-assignment')).toHaveCount(2);
    const pupil = await studentContexts[0]!.newPage();
    await pupil.goto('/mi-programa');
    await pupil.getByRole('button', { name: 'Consultar programa', exact: true }).click();
    await expect(pupil.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(pupil.getByLabel('Semana del programa').locator('option')).toHaveCount(8);
    await expect(pupil.getByText('45 kg', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Programas', exact: true }).click();
    await card.getByRole('button', { name: 'Editar programa', exact: true }).click();
    await stage('1. Estructura');
    await page.getByRole('button', { name: 'Editar semana 1', exact: true }).click();
    await stage('2. Ejercicios');
    await page.getByLabel('Serie 1 carga', { exact: true }).fill('65');
    await page.getByRole('button', { name: 'Publicar versión', exact: true }).click();
    await expect(page.getByText('Versión 2 publicada.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Volver a programas', exact: true }).click();
    await pupil.reload();
    await pupil.getByRole('button', { name: 'Consultar programa', exact: true }).click();
    await expect(pupil.getByText('VERSIÓN 1 · PLANIFICADO', { exact: true })).toBeVisible();
    await expect(pupil.getByText('45 kg', { exact: false })).toBeVisible();
    await expect(pupil.getByText('65 kg', { exact: false })).toHaveCount(0);
    for (const width of [320, 390, 768, 1280]) {
      await pupil.setViewportSize({ width, height: 900 });
      expect(
        await pupil.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `student ${width}`,
      ).toBe(true);
    }
    const program = (
      await (await request.get(root + '/programs?q=' + encodeURIComponent(name))).json()
    ).programs[0];
    const versions = (await (await request.get(root + `/programs/${program.id}/versions`)).json())
      .versions as Omit<ProgramVersion, 'snapshot'>[];
    expect(versions.map((v) => v.number)).toEqual([2, 1]);
    const assigned = (await (await request.get(root + '/program-assignments')).json())
      .assignments as ProgramAssignment[];
    expect(assigned.every((a) => a.versionId === versions[1]!.id)).toBe(true);
    await page.getByRole('button', { name: 'Asignaciones', exact: true }).click();
    const assignment = page.locator('.program-assignment').filter({ hasText: 'Alumno Uno' });
    await assignment.getByRole('button', { name: 'Cancelar asignación', exact: true }).click();
    await page.getByLabel('Motivo de cancelación').fill('Cambio de planificación de prueba');
    await page.getByRole('button', { name: 'Confirmar cancelación', exact: true }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await pupil.reload();
    await expect(pupil.getByRole('heading', { name: 'Pronto empezamos.' })).toBeVisible();
    expect(
      (
        await studentContexts[0]!.request.get(root + `/program-versions/${versions[1]!.id}`)
      ).status(),
    ).toBe(404);
    await page.getByRole('button', { name: 'Programas', exact: true }).click();
    await card.getByRole('button', { name: 'Editar programa', exact: true }).click();
    await stage('1. Estructura');
    await page.getByLabel('Nombre del programa', { exact: true }).fill(name + ' sin guardar');
    await page.route('**/v1/auth/logout', (route) => route.abort('failed'));
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).last().click();
    await expect(
      page.getByText('No pudimos conectar con tu estudio.', { exact: false }),
    ).toBeVisible();
    await expect(page.locator('.program-editor .status-badge')).toHaveText('Cambios sin guardar');
    await page.unroute('**/v1/auth/logout');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Volver a programas', exact: true }).click();
    await expect(page.getByLabel('Nombre del programa', { exact: true })).toHaveValue(
      name + ' sin guardar',
    );
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Volver a programas', exact: true }).click();
    await expect(card).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    for (const context of studentContexts) await context.close();
  }
});
