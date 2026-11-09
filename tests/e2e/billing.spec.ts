import 'dotenv/config';
import { test, expect } from '@playwright/test';
import pg from 'pg';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { monthlyAmount } from '@forma/shared';
import { workoutFixture } from './workout-fixture';
test.use({ trace: { mode: 'retain-on-failure', screenshots: false } });
test('T07 workout, progress, monthly account, adjustment and private manual receipt', async ({
  browser,
  request,
  page,
  baseURL,
}, info) => {
  if (new URL(baseURL!).hostname !== '127.0.0.1')
    throw new Error('This synthetic billing fixture is local only.');
  const f = await workoutFixture(request, browser, baseURL!, 'T07 ' + info.project.name),
    adminContext = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 1000 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
    }),
    db = new pg.Pool({ connectionString: process.env.DATABASE_ADMIN_URL, max: 1 }),
    pupil = await f.context.newPage(),
    adminPage = await adminContext.newPage(),
    errors: string[] = [];
  for (const p of [page, pupil, adminPage]) p.on('pageerror', (e) => errors.push(e.message));
  try {
    let session = f.session;
    for (const command of [
      { kind: 'session.start', expectedRevision: 0 },
      {
        kind: 'set.save',
        expectedRevision: 0,
        entryId: session.sets[0]!.entryId,
        setId: session.sets[0]!.setId,
        actual: {
          weightKg: 42.5,
          reps: 10,
          seconds: null,
          distanceMeters: null,
          rpe: null,
          note: '',
        },
      },
      {
        kind: 'session.complete',
        notes: 'Sesión ficticia para cuenta',
        durationSeconds: 300,
        allowPartial: true,
      },
    ]) {
      const r = await f.context.request.post(f.root + `/workouts/${session.id}/events`, {
        headers: f.studentHeaders,
        data: {
          clientEventId: randomUUID(),
          deviceId: randomUUID(),
          command: {
            expectedRevision: session.revision,
            clientOccurredAt: new Date().toISOString(),
            ...command,
          },
        },
      });
      expect(r.ok(), await r.text()).toBe(true);
      const data = await r.json();
      expect(data.receipt.status, JSON.stringify(data.receipt)).toBe('accepted');
      session = data.session;
    }
    await pupil.goto('/progreso');
    await expect(
      pupil.locator('.progress-metric').filter({ hasText: 'Volumen conocido' }),
    ).toContainText('425');
    const org = (await (await request.get('/v1/organizations')).json()).organizations.find(
      (o: { id: string }) => f.root.includes(o.id),
    );
    expect(org.name).toBe('Estudio de prueba T05');
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - 1);
    const month = date.toISOString().slice(0, 7),
      monthDays = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(),
      total = monthlyAmount(10000, 15, monthDays),
      start = month + '-01T00:00:00-03:00',
      end = month + '-16T00:00:00-03:00';
    // Backdating is restricted to this newly created fictitious studio, not exposed by the API.
    await db.query(
      "INSERT INTO saas_billing_enrollments(organization_id,started_at,initial_plan_version_id,created_by,reason)VALUES($1,$2,'52000000-0000-4000-8000-000000000001',(SELECT id FROM app_users WHERE email='admin@forma.local'),'Fixture sintético E2E T07')",
      [org.id, start],
    );
    await db.query(
      'UPDATE saas_subscriptions SET trial_ends_at=$1::timestamptz WHERE organization_id=$2',
      [start, org.id],
    );
    await db.query(
      'INSERT INTO student_billable_intervals(organization_id,student_id,opened_at,closed_at)VALUES($1,$2,$3,$4)',
      [org.id, f.student.id, start, end],
    );
    const token = (await (await adminContext.request.get('/v1/security/csrf')).json()).token;
    expect(
      (
        await adminContext.request.post('/v1/auth/login', {
          headers: { 'x-csrf-token': token },
          data: { email: 'admin@forma.local', password: 'Forma-demo-2026!' },
        })
      ).ok(),
    ).toBe(true);
    await adminPage.goto('/admin/cuenta?organizationId=' + org.id);
    await expect(adminPage.getByRole('heading', { name: 'Cuenta del estudio' })).toBeVisible();
    await adminPage.getByLabel('Mes de cuenta').fill(month);
    await adminPage.getByRole('button', { name: 'Consultar mes', exact: true }).click();
    await expect(adminPage.locator('.billing-breakdown footer')).toContainText(
      new Intl.NumberFormat('es-PY').format(total),
    );
    await expect(adminPage.locator('.billing-line').first()).toContainText('15 /');
    adminPage.once('dialog', (d) => d.accept());
    await adminPage.getByRole('button', { name: 'Emitir cuenta del mes' }).click();
    await expect(adminPage.getByRole('heading', { name: 'Saldo pendiente.' })).toBeVisible();
    await adminPage.getByLabel('Tipo de movimiento').selectOption('adjustment');
    await adminPage.getByLabel('Importe (PYG enteros)').fill('-100');
    await adminPage.getByLabel('Motivo del ajuste').fill('Abono sintético verificado en prueba');
    await adminPage.getByRole('button', { name: 'Confirmar movimiento' }).click();
    await expect(adminPage.locator('.billing-movements')).toContainText('Abono sintético');
    await adminPage.getByLabel('Tipo de movimiento').selectOption('payment');
    await adminPage.getByLabel('Importe (PYG enteros)').fill(String(total - 100));
    await adminPage.getByLabel('Referencia de pago').fill('Transferencia ficticia E2E');
    const bytes = await sharp({
      create: { width: 120, height: 160, channels: 3, background: '#225577' },
    })
      .png()
      .toBuffer();
    await adminPage
      .getByLabel('Comprobante opcional (imagen)')
      .setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: bytes });
    // The server commits, but the browser loses its response. Retry must retain the UUID.
    const paymentRoute = '**/billing/invoices/*/payments';
    let committedRequestId = '';
    await adminPage.route(paymentRoute, async (route) => {
      committedRequestId = route.request().postDataJSON().requestId;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.abort('failed');
    });
    await adminPage.getByRole('button', { name: 'Confirmar movimiento' }).click();
    await expect(adminPage.getByRole('alert')).toBeVisible();
    await expect(adminPage.getByLabel('Referencia de pago')).toHaveValue(
      'Transferencia ficticia E2E',
    );
    await expect(adminPage.getByLabel('Importe (PYG enteros)')).toHaveValue(String(total - 100));
    expect(
      await adminPage
        .getByLabel('Comprobante opcional (imagen)')
        .evaluate((e) => (e as HTMLInputElement).files?.[0]?.name),
    ).toBe('receipt.png');
    await adminPage.unroute(paymentRoute);
    const retry = adminPage.waitForRequest(
      (r) => r.method() === 'POST' && r.url().endsWith('/payments'),
    );
    await adminPage.getByRole('button', { name: 'Confirmar movimiento' }).click();
    expect((await retry).postDataJSON().requestId).toBe(committedRequestId);
    await expect(adminPage.getByRole('heading', { name: 'Cuenta saldada.' })).toBeVisible();
    await expect(adminPage.getByLabel('Comprobante opcional (imagen)')).toHaveValue('');
    const paymentCount = await db.query(
      'SELECT count(*)::integer count FROM saas_payments WHERE organization_id=$1',
      [org.id],
    );
    expect(paymentCount.rows[0].count).toBe(1);
    const receipt = await adminPage
      .getByRole('link', { name: 'Ver comprobante privado' })
      .getAttribute('href');
    expect((await f.context.request.get(receipt!)).status()).toBe(404);
    expect((await request.get(receipt!)).status()).toBe(200);
    await page.context().addCookies((await request.storageState()).cookies);
    await page.goto('/cuenta');
    await expect(page.getByRole('heading', { name: 'Mi mensualidad' })).toBeVisible();
    await page.getByLabel('Mes', { exact: true }).fill(month);
    await page.getByRole('button', { name: 'Consultar mes', exact: true }).click();
    await expect(page.getByText('Pendiente', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar movimiento' })).toHaveCount(0);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `account ${width}`,
      ).toBe(true);
      expect(await page.locator('.bottom-nav a').count()).toBeLessThanOrEqual(5);
      expect(
        await page.getByLabel('Mes', { exact: true }).evaluate((e) => getComputedStyle(e).fontSize),
      ).toBe('16px');
    }
    await page.screenshot({
      path: `docs/evidencias/t07-${info.project.name}-cuenta-pc.png`,
      scale: 'css',
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `docs/evidencias/t07-${info.project.name}-cuenta-movil.png`,
      scale: 'css',
      fullPage: true,
    });
    await adminPage.screenshot({
      path: `docs/evidencias/t07-${info.project.name}-admin.png`,
      scale: 'css',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Activar tema oscuro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.screenshot({
      path: `docs/evidencias/t07-${info.project.name}-cuenta-oscuro.png`,
      scale: 'css',
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await db.end();
    await f.context.close();
    await adminContext.close();
  }
});
