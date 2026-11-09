/* global document, innerWidth, getComputedStyle */
// One opt-in WebKit payment pass, isolated DB/storage, no full-page captures or worker.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { resolve, sep, basename } from 'node:path';
import pg from 'pg';
import sharp from 'sharp';
import { webkit, request as requests } from 'playwright';
import { preview } from 'vite';
import { buildApp } from '../../apps/api/src/app.ts';
import { isolatedDatabase } from '../helpers/database.ts';
import { monthlyAmount, product } from '@forma/shared';

assert.equal(process.env.FORMA_T14_WEBKIT_QA, '1');
for (const key of ['DATABASE_ADMIN_URL', 'DATABASE_URL']) {
  const url = new URL(process.env[key]);
  assert(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/forma');
}
const baseURL = 'http://127.0.0.1:5185',
  fixture = isolatedDatabase();
assert(
  /^\/forma_test_[a-f0-9]{32}$/.test(new URL(fixture.url(process.env.DATABASE_ADMIN_URL)).pathname),
);
const report = {
  version: product.version,
  scope: 'isolated-webkit-payment-continuation',
  status: 'running',
  browserInstances: 0,
  screenshots: 0,
  traces: 0,
  pdfGenerations: 0,
  mainDatabaseDomainMutations: 0,
  mailsSent: 0,
  checks: [],
  pageErrors: [],
  limits:
    'One WebKit page, 45 second work budget, 6 second individual UI actions; no historical workout/progress flow or native iPhone claim.',
};
const start = Date.now(),
  contexts = [],
  password = 'Synthetic-T14-' + randomUUID();
let server,
  vite,
  browser,
  pool,
  directory,
  stage = 'fixture';
const timer = setTimeout(() => {
  report.budgetExceeded = true;
  void browser?.close();
}, 45000);
async function post(context, url, data, expected = 200) {
  assert(Date.now() - start < 45000, 'Work budget exceeded');
  const csrf = await context.get('/v1/security/csrf');
  assert.equal(csrf.status(), 200);
  const response = await context.post(url, {
    data,
    headers: { 'x-csrf-token': (await csrf.json()).token },
  });
  report.lastPreparationStatus = response.status();
  report.lastPreparationRoute = url.replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi, ':id');
  assert.equal(response.status(), expected, 'Unexpected response during synthetic preparation');
  return response.json();
}
async function apiContext() {
  const context = await requests.newContext({ baseURL, timeout: 6000 });
  contexts.push(context);
  return context;
}
try {
  directory = await fixture.create();
  pool = new pg.Pool({
    connectionString: fixture.url(process.env.DATABASE_ADMIN_URL),
    max: 1,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
  });
  server = await buildApp({
    origin: baseURL,
    cookieSecret: 'isolated-webkit-cookie-secret-at-least-32-characters',
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    storageRoot: directory,
  });
  await server.listen({ host: '127.0.0.1', port: 3008 });
  vite = await preview({
    configFile: 'apps/web/vite.config.ts',
    preview: {
      host: '127.0.0.1',
      port: 5185,
      strictPort: true,
      proxy: { '/v1': { target: 'http://127.0.0.1:3008', ws: true } },
    },
  });
  const owner = await apiContext(),
    admin = await apiContext(),
    pupil = await apiContext();
  const ownerEmail = 'owner-' + randomUUID() + '@example.test',
    adminEmail = 'admin-' + randomUUID() + '@example.test',
    pupilEmail = 'pupil-' + randomUUID() + '@example.test';
  const created = await post(
    owner,
    '/v1/auth/register-coach',
    {
      fullName: 'Coach QA',
      email: ownerEmail,
      password,
      name: 'Estudio QA aislado',
      slug: 'webkit-' + randomUUID().slice(0, 8),
      kind: 'coach',
      accent: '#005ea8',
      plan: 'basic',
      privacyAccepted: true,
    },
    201,
  );
  const org = created.organizationId,
    root = `/v1/organizations/${org}`,
    adminId = randomUUID();
  const ownerId = (await (await owner.get('/v1/auth/me')).json()).user.id;
  await pool.query('UPDATE app_users SET email_verified_at=now() WHERE id=$1', [ownerId]);
  await pool.query(
    `INSERT INTO app_users(id,email,password_hash,full_name,is_superadmin,email_verified_at)
    SELECT $1,$2,password_hash,'Admin QA',true,now() FROM app_users WHERE id=$3`,
    [adminId, adminEmail, ownerId],
  );
  await post(admin, '/v1/auth/login', { email: adminEmail, password });
  const control = (
    await (
      await owner.get(root + '/monthly-control?month=' + new Date().toISOString().slice(0, 7))
    ).json()
  ).control;
  const approvalToken = (await (await admin.get('/v1/security/csrf')).json()).token;
  assert.equal(
    (
      await admin.put('/v1/admin/organizations/' + org + '/manual-control', {
        headers: { 'x-csrf-token': approvalToken },
        data: {
          studentLimit: 25,
          monthlyPricePyg: null,
          accessEnabled: true,
          revision: control.revision,
          requestId: randomUUID(),
          reason: 'Aprobación explícita de fixture sintética T14',
        },
      })
    ).status(),
    200,
  );

  const student = (
    await post(
      owner,
      root + '/students',
      { displayName: 'Alumno QA', email: pupilEmail, goal: 'Fuerza' },
      201,
    )
  ).student;
  const invitation = await post(owner, root + `/students/${student.id}/invitation`, {});
  await post(pupil, '/v1/invitations/accept', {
    token: new URL(invitation.url).searchParams.get('token'),
    fullName: 'Alumno QA',
    goal: 'Fuerza',
    password,
    privacyAccepted: true,
  });
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  const month = date.toISOString().slice(0, 7),
    monthDays = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const total = monthlyAmount(10000, 15, monthDays),
    startAt = month + '-01T00:00:00-03:00',
    endAt = month + '-16T00:00:00-03:00';
  await pool.query(
    `INSERT INTO saas_billing_enrollments(organization_id,started_at,initial_plan_version_id,created_by,reason)
    SELECT organization_id,$2,plan_version_id,$3,'Ensayo aislado WebKit T14' FROM saas_subscriptions WHERE organization_id=$1`,
    [org, startAt, adminId],
  );
  await pool.query('UPDATE saas_subscriptions SET trial_ends_at=$2 WHERE organization_id=$1', [
    org,
    startAt,
  ]);
  await pool.query(
    'INSERT INTO student_billable_intervals(organization_id,student_id,opened_at,closed_at)VALUES($1,$2,$3,$4)',
    [org, student.id, startAt, endAt],
  );
  const issued = await post(admin, root + '/billing/issue', { month });
  assert.equal(issued.invoice.totalPyg, total);
  await post(admin, root + `/billing/invoices/${issued.invoice.id}/adjustments`, {
    requestId: randomUUID(),
    amountPyg: -100,
    reason: 'Abono sintético aislado T14',
  });
  stage = 'browser';
  assert(Date.now() - start < 45000);
  browser = await webkit.launch({ headless: true, timeout: 8000 });
  report.browserInstances = 1;
  const context = await browser.newContext({
    baseURL,
    storageState: await admin.storageState(),
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  page.setDefaultNavigationTimeout(6000);
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  await page.goto('/admin/cuenta?organizationId=' + org);
  await page.getByLabel('Mes de cuenta').fill(month);
  await page.getByRole('button', { name: 'Consultar mes', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir cuenta emitida' }).click();
  await page.getByRole('heading', { name: 'Saldo pendiente.', exact: true }).waitFor();
  await page.getByLabel('Importe (PYG enteros)').fill(String(total - 100));
  await page.getByLabel('Referencia de pago').fill('Comprobante sintético T14');
  const bytes = await sharp({
    create: { width: 16, height: 16, channels: 3, background: '#225577' },
  })
    .png()
    .toBuffer();
  const input = page.getByLabel('Comprobante opcional (imagen)');
  await input.setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: bytes });
  stage = 'lost-response';
  const pattern = '**/billing/invoices/*/payments';
  let requestId;
  await page.route(pattern, async (route) => {
    requestId = route.request().postDataJSON().requestId;
    const response = await route.fetch({ timeout: 6000 });
    assert.equal(response.status(), 200);
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Confirmar movimiento' }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(
    await page.getByLabel('Referencia de pago').inputValue(),
    'Comprobante sintético T14',
  );
  assert.equal(await page.getByLabel('Importe (PYG enteros)').inputValue(), String(total - 100));
  assert.equal(await input.evaluate((element) => element.files?.[0]?.name), 'receipt.png');
  report.checks.push('lost response preserves amount, reference and native selected file');
  stage = 'retry';
  await page.unroute(pattern);
  const retry = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/payments'),
  );
  await page.getByRole('button', { name: 'Confirmar movimiento' }).click();
  assert.equal((await retry).postDataJSON().requestId, requestId);
  await page.getByRole('heading', { name: 'Cuenta saldada.', exact: true }).waitFor();
  assert.equal(await input.inputValue(), '');
  assert.equal(
    (
      await pool.query('SELECT count(*)::int count FROM saas_payments WHERE organization_id=$1', [
        org,
      ])
    ).rows[0].count,
    1,
  );
  report.checks.push(
    'retry keeps intention ID, creates one payment, settles account and clears native input',
  );
  const receipt = await page
    .getByRole('link', { name: 'Ver comprobante privado' })
    .getAttribute('href');
  assert.equal((await owner.get(receipt)).status(), 200);
  assert.equal((await pupil.get(receipt)).status(), 404);
  report.checks.push('private receipt allowed to owner and denied to pupil');
  stage = 'owner-layout';
  await context.clearCookies();
  await context.addCookies((await owner.storageState()).cookies);
  await page.goto('/cuenta');
  await page.getByRole('heading', { name: 'Mi mensualidad', exact: true }).waitFor();
  await page.getByLabel('Mes', { exact: true }).fill(month);
  await page.getByRole('button', { name: 'Consultar mes', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Confirmar movimiento' }).count(), 0);
  report.viewportWidths = [];
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.equal(
      await page
        .getByLabel('Mes', { exact: true })
        .evaluate((element) => getComputedStyle(element).fontSize),
      '16px',
    );
    report.viewportWidths.push(width);
  }
  assert(
    !/maximum-scale|user-scalable=no/.test(
      await page.locator('meta[name=viewport]').getAttribute('content'),
    ),
  );
  assert.deepEqual(report.pageErrors, []);
  report.checks.push(
    'owner read only, no overflow at 320/1440, field 16px and native zoom allowed',
  );
  assert(!report.budgetExceeded);
  report.status = 'passed';
  delete report.lastPreparationStatus;
  delete report.lastPreparationRoute;
} catch (error) {
  report.status = 'failed';
  report.stage = stage;
  // Only controlled assertions are safe to publish; no response bodies/credentials.
  report.failure =
    error?.code === 'ENOENT'
      ? 'Required local resource missing'
      : 'Case did not complete; inspect stage locally.';
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  await browser?.close();
  for (const context of contexts) await context.dispose();
  await server?.close();
  if (vite) await new Promise((done) => vite.httpServer.close(done));
  await pool?.end();
  await fixture.drop();
  report.isolatedDatabaseDropped = true;
  if (directory) {
    const absolute = resolve(directory),
      base = resolve('.local/test-storage');
    assert(absolute.startsWith(base + sep) && /^forma_test_[a-f0-9]{32}-/.test(basename(absolute)));
    await rm(absolute, { recursive: true, force: true });
    report.isolatedStorageRemoved = true;
  }
  report.durationMs = Date.now() - start;
  await writeFile('docs/evidencias/t14-webkit-cuenta.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
