import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { workoutFixture } from './workout-fixture';
test('T06 confirmed charts, mobile tables, measurements and revocable private photos', async ({
  browser,
  request,
  page,
  baseURL,
}, info) => {
  const f = await workoutFixture(request, browser, baseURL!, 'T06 ' + info.project.name),
    pupil = await f.context.newPage(),
    errors: string[] = [];
  pupil.on('pageerror', (e) => errors.push(e.message));
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    let session = f.session;
    async function event(command: Record<string, unknown>) {
      const r = await f.context.request.post(f.root + `/workouts/${session.id}/events`, {
        headers: f.studentHeaders,
        data: {
          clientEventId: randomUUID(),
          deviceId: randomUUID(),
          command: {
            clientOccurredAt: new Date().toISOString(),
            expectedRevision: session.revision,
            ...command,
          },
        },
      });
      expect(r.ok(), await r.text()).toBe(true);
      const data = await r.json();
      expect(data.receipt.status).toBe('accepted');
      session = data.session;
    }
    await event({ kind: 'session.start' });
    await event({
      kind: 'set.save',
      expectedRevision: 0,
      entryId: session.sets[0]!.entryId,
      setId: session.sets[0]!.setId,
      actual: { weightKg: 42.5, reps: 10, seconds: null, distanceMeters: null, rpe: 7, note: '' },
    });
    await event({
      kind: 'session.complete',
      notes: 'Parcial de prueba',
      durationSeconds: 300,
      allowPartial: true,
    });
    await pupil.goto('/progreso');
    await expect(pupil.getByRole('heading', { name: 'Tu progreso, paso a paso.' })).toBeVisible();
    const volume = pupil.locator('.progress-metric').filter({ hasText: 'Volumen conocido' });
    await expect(volume).toContainText('425');
    await expect(
      pupil.locator('.progress-metric').filter({ hasText: 'Días completados' }),
    ).toContainText('100%');
    await expect(pupil.getByText('1 parciales · 0 en curso')).toBeVisible();
    for (const width of [320, 390, 768, 1440]) {
      await pupil.setViewportSize({ width, height: 900 });
      expect(
        await pupil.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `training ${width}`,
      ).toBe(true);
      if (width === 320)
        await expect
          .poll(() =>
            pupil
              .locator('.progress-chart svg')
              .first()
              .evaluate((e: SVGSVGElement) => e.viewBox.baseVal.width),
          )
          .toBeLessThan(321);
      expect(
        await pupil
          .getByLabel('Desde', { exact: true })
          .evaluate((e) => getComputedStyle(e).fontSize),
      ).toBe('16px');
    }
    await pupil.screenshot({
      path: `docs/evidencias/t06-${info.project.name}-pc.png`,
      fullPage: true,
    });
    await pupil.getByText('Ver tabla de volumen por semana', { exact: true }).click();
    await expect(pupil.getByRole('table').first()).toContainText('425');
    await pupil.setViewportSize({ width: 390, height: 844 });
    await pupil.evaluate(() => window.scrollTo(0, 0));
    await pupil.screenshot({
      path: `docs/evidencias/t06-${info.project.name}-alumno.png`,
      fullPage: true,
    });
    await pupil.getByRole('button', { name: 'Mediciones', exact: true }).click();
    await pupil.getByLabel('Valor (kg)', { exact: true }).fill('70.5');
    await pupil.getByRole('button', { name: 'Guardar medición', exact: true }).click();
    await expect(pupil.locator('.progress-measurement-row')).toHaveCount(1);
    await expect(pupil.locator('.progress-measurement-row')).toContainText('70,5 kg');
    await pupil.getByLabel('Valor (kg)', { exact: true }).fill('71');
    await pupil.getByRole('button', { name: 'Guardar medición', exact: true }).click();
    await expect(pupil.locator('.progress-measurement-row')).toHaveCount(2);
    pupil.once('dialog', (d) => d.accept('Dato introducido por error'));
    await pupil
      .locator('.progress-measurement-row')
      .filter({ hasText: '71 kg' })
      .getByRole('button', { name: 'Anular con motivo' })
      .click();
    await expect(pupil.getByText('Anulada: Dato introducido por error')).toBeVisible();
    await pupil.setViewportSize({ width: 320, height: 844 });
    expect(await pupil.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await pupil.setViewportSize({ width: 390, height: 844 });
    await pupil.evaluate(() => window.scrollTo(0, 0));
    await pupil.screenshot({
      path: `docs/evidencias/t06-${info.project.name}-mediciones.png`,
      fullPage: true,
    });
    await page.context().addCookies((await request.storageState()).cookies);
    await page.goto('/progreso');
    await expect(page.getByRole('heading', { name: 'Cada alumno, un recorrido.' })).toBeVisible();
    await page.screenshot({
      path: `docs/evidencias/t06-${info.project.name}-cohorte.png`,
      fullPage: true,
    });
    await page.getByRole('link', { name: 'Ver progreso', exact: false }).click();
    await expect(page.getByRole('heading', { name: 'Alumna Sesiones', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Mediciones', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mediciones privadas.' })).toBeVisible();
    await page.getByRole('button', { name: 'Entrenamiento', exact: true }).click();
    await page.screenshot({
      path: `docs/evidencias/t06-${info.project.name}-coach.png`,
      fullPage: true,
    });
    await pupil.getByRole('button', { name: 'Fotos', exact: true }).click();
    await expect(pupil.getByRole('heading', { name: 'Las fotos son opcionales.' })).toBeVisible();
    await pupil.getByRole('button', { name: 'Revisar privacidad' }).click();
    await pupil
      .getByRole('checkbox', { name: 'Quiero usar fotos de progreso', exact: false })
      .check();
    await pupil.getByRole('checkbox', { name: 'Compartir mediciones con Coach Sesiones' }).check();
    await pupil.getByRole('button', { name: 'Guardar privacidad' }).click();
    await expect(pupil.getByText('Permisos sin guardar.')).toHaveCount(0);
    await pupil.getByRole('button', { name: 'Fotos', exact: true }).click();
    const bytes = await sharp({
      create: { width: 600, height: 800, channels: 3, background: '#005ea8' },
    })
      .png()
      .toBuffer();
    await pupil
      .getByLabel('Foto de progreso', { exact: true })
      .setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: bytes });
    const refresh = pupil.waitForResponse(
      (r) => r.url().includes('/progress/' + f.student.id + '?') && r.status() === 200,
    );
    await pupil.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await refresh;
    await expect(pupil.getByText('Consultando resultados confirmados…')).toHaveCount(0);
    expect(
      await pupil
        .getByLabel('Foto de progreso', { exact: true })
        .evaluate((e: HTMLInputElement) => e.files?.length),
    ).toBe(1);
    await pupil.getByLabel('Descripción opcional').fill('Imagen sintética de prueba');
    await pupil.getByRole('button', { name: 'Guardar foto privada' }).click();
    await expect(pupil.locator('.progress-photo-card')).toHaveCount(1);
    await expect
      .poll(() =>
        pupil.locator('.progress-photo-card img').evaluate((e: HTMLImageElement) => e.naturalWidth),
      )
      .toBeGreaterThan(0);
    const privateUrl = await pupil.locator('.progress-photo-card img').getAttribute('src');
    expect((await request.get(privateUrl!)).status()).toBe(404);
    await pupil.getByRole('button', { name: 'Privacidad', exact: true }).click();
    await pupil.getByRole('checkbox', { name: 'Compartir fotos con Coach Sesiones' }).check();
    await pupil.getByRole('button', { name: 'Guardar privacidad' }).click();
    await expect(pupil.getByText('Permisos sin guardar.')).toHaveCount(0);
    await page.reload();
    await page.getByRole('button', { name: 'Mediciones', exact: true }).click();
    await expect(page.locator('.progress-measurement-row')).toHaveCount(2);
    await page.getByRole('button', { name: 'Fotos', exact: true }).click();
    await expect(page.locator('.progress-photo-card')).toHaveCount(1);
    await expect
      .poll(() =>
        page.locator('.progress-photo-card img').evaluate((e: HTMLImageElement) => e.naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.screenshot({
      path: `docs/evidencias/t06-${info.project.name}-coach-fotos.png`,
      fullPage: true,
    });
    await pupil.getByRole('checkbox', { name: 'Compartir fotos con Coach Sesiones' }).uncheck();
    await pupil.getByRole('button', { name: 'Guardar privacidad' }).click();
    await expect(pupil.getByText('Permisos sin guardar.')).toHaveCount(0);
    expect((await request.get(privateUrl!)).status()).toBe(404);
    await page.reload();
    await page.getByRole('button', { name: 'Fotos', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Las fotos son opcionales.' })).toBeVisible();
    await pupil.setViewportSize({ width: 320, height: 844 });
    expect(await pupil.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await pupil.setViewportSize({ width: 390, height: 844 });
    await pupil.evaluate(() => window.scrollTo(0, 0));
    await pupil.screenshot({
      path: `docs/evidencias/t06-${info.project.name}-privacidad.png`,
      fullPage: true,
    });
    await pupil.getByRole('button', { name: 'Activar tema oscuro' }).click();
    await expect(pupil.locator('html')).toHaveAttribute('data-theme', 'dark');
    await pupil.screenshot({
      path: `docs/evidencias/t06-${info.project.name}-oscuro.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await f.context.close();
  }
});
