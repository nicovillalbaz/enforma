import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { workoutFixture } from './workout-fixture';
test('T05 durable recording, duplicate response retry, conflict, undo and coach summary', async ({
  browser,
  request,
  baseURL,
}, info) => {
  const f = await workoutFixture(request, browser, baseURL!, info.project.name),
    page = await f.context.newPage(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(f.preparePath);
    await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page.getByText('Todos los cambios confirmados por el servidor')).toBeVisible();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `workout ${width}`,
      ).toBe(true);
      expect(
        await page
          .getByLabel('Repeticiones', { exact: true })
          .evaluate((el) => getComputedStyle(el).fontSize),
      ).toBe('16px');
    }
    await page.getByLabel('Carga (kg, opcional)', { exact: true }).fill('42.5');
    await page.getByLabel('Repeticiones', { exact: true }).fill('9');
    let lost = false;
    await page.route('**/workouts/*/events', async (route) => {
      if (!lost && route.request().postDataJSON().command.kind === 'set.save') {
        lost = true;
        await route.fetch();
        await route.abort('failed');
      } else await route.continue();
    });
    await page.getByRole('button', { name: 'Guardar serie', exact: true }).dblclick();
    await expect.poll(() => lost).toBe(true);
    await expect(page.getByRole('alert')).toContainText('No pudimos conectar');
    await expect(
      page.getByText('1 cambio(s) guardados en este dispositivo', { exact: false }),
    ).toBeVisible();
    await page.unroute('**/workouts/*/events');
    // Resume through the real online handler; a scheduled retry may already remove the button.
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.getByText('Todos los cambios confirmados por el servidor')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    let server = (await (await f.context.request.get(f.root + `/workouts/${f.session.id}`)).json())
      .session;
    expect(server.sets[0].revision).toBe(1);
    expect(server.sets[0].actual.weightKg).toBe(42.5);
    const s = server.sets[1],
      other = {
        clientEventId: randomUUID(),
        deviceId: randomUUID(),
        command: {
          kind: 'set.save',
          entryId: s.entryId,
          setId: s.setId,
          expectedRevision: s.revision,
          clientOccurredAt: new Date().toISOString(),
          actual: {
            weightKg: 55,
            reps: 11,
            seconds: null,
            distanceMeters: null,
            rpe: null,
            note: 'Otro dispositivo',
          },
        },
      };
    const refreshedCsrf = (await (await f.context.request.get('/v1/security/csrf')).json()).token;
    const otherResponse = await f.context.request.post(
      f.root + `/workouts/${f.session.id}/events`,
      { headers: { 'x-csrf-token': refreshedCsrf }, data: other },
    );
    expect(otherResponse.ok(), await otherResponse.text()).toBe(true);
    await page.getByLabel('Carga (kg, opcional)', { exact: true }).fill('45');
    await page.getByLabel('Repeticiones', { exact: true }).fill('10');
    await page.getByRole('button', { name: 'Guardar serie', exact: true }).click();
    await expect(
      page.getByText('Revisa un cambio antes de continuar.', { exact: false }),
    ).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Aplicar mi registro', exact: true }).click();
    await expect(page.getByText('Todos los cambios confirmados por el servidor')).toBeVisible();
    // Undo the second set, preserving its original audit facts.
    await page
      .getByRole('navigation', { name: 'Series del entrenamiento' })
      .getByRole('button')
      .nth(1)
      .click();
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await expect(page.getByText('Todos los cambios confirmados por el servidor')).toBeVisible();
    await page
      .getByLabel('Notas de la sesión', { exact: true })
      .fill('Sesión parcial, técnica controlada.');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Finalizar sesión', exact: false }).click();
    await expect(
      page.getByRole('heading', { name: 'Sesión registrada. Buen trabajo.' }),
    ).toBeVisible();
    await expect(page.getByText('Todos los cambios confirmados por el servidor')).toBeVisible();
    server = (await (await request.get(f.root + `/workouts?studentId=${f.student.id}`)).json())
      .sessions[0];
    expect(server.state).toBe('completed');
    expect(server.sets.filter((s: { state: string }) => s.state === 'recorded')).toHaveLength(1);
    expect(server.notes).toContain('técnica controlada');
    await page.goto('/historial');
    await page.getByText('Ver objetivos y valores realizados').click();
    await expect(page.getByText('Realizado: 42.5 kg · 9 rep', { exact: false })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await f.context.close();
  }
});
