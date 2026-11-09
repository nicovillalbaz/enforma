/* global document,innerWidth,getComputedStyle */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile, rm } from 'node:fs/promises';
import { resolve, sep, basename } from 'node:path';
import pg from 'pg';
import { chromium, request } from 'playwright';
import { preview } from 'vite';
import { product } from '@forma/shared';
import { buildApp } from '../../apps/api/src/app.ts';
import { isolatedDatabase } from '../helpers/database.ts';
assert.equal(process.env.FORMA_T14_CONTROLS_QA, '1');
const base = new URL(process.env.DATABASE_ADMIN_URL);
assert(['127.0.0.1', 'localhost'].includes(base.hostname) && base.pathname === '/forma');
const fixture = isolatedDatabase(),
  baseURL = 'http://127.0.0.1:5190',
  contexts = [],
  password = 'Synthetic-' + randomUUID(),
  started = Date.now();
const report = {
  version: product.version,
  scope: 'isolated-monthly-admin-and-coach',
  browserInstances: 0,
  pageErrors: [],
  checks: [],
  pdfGenerations: 0,
  screenshots: 0,
  mainDatabaseDomainMutations: 0,
};
let app,
  vite,
  browser,
  db,
  directory,
  stage = 'setup';
const timer = setTimeout(() => {
  report.budgetExceeded = true;
  void browser?.close();
}, 45000);
async function context() {
  const c = await request.newContext({ baseURL, timeout: 6000 });
  contexts.push(c);
  return c;
}
async function post(c, path, body, status = 200) {
  const token = (await (await c.get('/v1/security/csrf')).json()).token;
  const r = await c.post(path, { data: body, headers: { 'x-csrf-token': token } });
  assert.equal(r.status(), status, 'Synthetic preparation failed');
  return r.json();
}
async function metrics(page, width) {
  await page.setViewportSize({ width, height: 900 });
  const m = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    fields: [...document.querySelectorAll('input:not([type=checkbox])')]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .every((e) => parseFloat(getComputedStyle(e).fontSize) >= 16),
    actions: [...document.querySelectorAll('.monthly-actions button')].every(
      (e) => e.getBoundingClientRect().height >= 44,
    ),
  }));
  assert(!m.overflow && m.fields && m.actions, JSON.stringify({ width, ...m }));
}
try {
  directory = await fixture.create();
  db = new pg.Pool({
    connectionString: fixture.url(process.env.DATABASE_ADMIN_URL),
    max: 1,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
  });
  app = await buildApp({
    origin: baseURL,
    cookieSecret: 'monthly-visual-cookie-secret-longer-than-32',
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    storageRoot: directory,
  });
  await app.listen({ host: '127.0.0.1', port: 3009 });
  vite = await preview({
    configFile: 'apps/web/vite.config.ts',
    preview: {
      host: '127.0.0.1',
      port: 5190,
      strictPort: true,
      proxy: { '/v1': { target: 'http://127.0.0.1:3009', ws: true } },
    },
  });
  const owner = await context(),
    admin = await context(),
    pupil = await context(),
    ownerEmail = randomUUID() + '@example.test',
    adminEmail = randomUUID() + '@example.test';
  const created = await post(
    owner,
    '/v1/auth/register-coach',
    {
      fullName: 'Coach QA',
      email: ownerEmail,
      password,
      name: 'Coach mensual QA',
      slug: 'monthly-' + randomUUID().slice(0, 8),
      kind: 'coach',
      accent: '#005ea8',
      plan: 'basic',
      privacyAccepted: true,
    },
    201,
  );
  const org = created.organizationId,
    root = '/v1/organizations/' + org,
    ownerId = (await (await owner.get('/v1/auth/me')).json()).user.id;
  await db.query('UPDATE app_users SET email_verified_at=now() WHERE id=$1', [ownerId]);
  await db.query(
    "INSERT INTO app_users(id,email,password_hash,full_name,is_superadmin,email_verified_at) SELECT $1,$2,password_hash,'Admin QA',true,now() FROM app_users WHERE id=$3",
    [randomUUID(), adminEmail, ownerId],
  );
  await post(admin, '/v1/auth/login', { email: adminEmail, password });
  browser = await chromium.launch({ headless: true, timeout: 8000 });
  report.browserInstances = 1;
  const browserContext = await browser.newContext({
      baseURL,
      storageState: await admin.storageState(),
      viewport: { width: 1440, height: 900 },
      serviceWorkers: 'block',
    }),
    page = await browserContext.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', (e) => report.pageErrors.push(e.message));
  stage = 'admin-control';
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Configurar coach', exact: true }).click();
  await page.getByLabel('Precio mensual (PYG, opcional)').fill('125000');
  await page.getByLabel('Cupo de alumnos habilitados').fill('2');
  await page.getByLabel('Habilitar acceso del coach').check();
  await page.getByLabel('Motivo del cambio').fill('Configuración sintética aprobada');
  await metrics(page, 320);
  await metrics(page, 1440);
  await page.screenshot({ path: 'docs/evidencias/t14-control-admin-pc.png' });
  report.screenshots++;
  await page.getByRole('button', { name: 'Guardar configuración', exact: true }).click();
  await page.getByText('Configuración y acceso guardados.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Marcar pagado', exact: true }).click();
  await page.getByText('Mes actualizado. El acceso no cambió.', { exact: true }).waitFor();
  report.checks.push('admin sets monthly price/cap/access and separately marks month');
  const student = (
    await post(
      owner,
      root + '/students',
      { displayName: 'Alumno mensual QA', email: randomUUID() + '@example.test', goal: '' },
      201,
    )
  ).student;
  const invitation = await post(owner, root + '/students/' + student.id + '/invitation', {});
  await post(pupil, '/v1/invitations/accept', {
    token: new URL(invitation.url).searchParams.get('token'),
    fullName: 'Alumno mensual QA',
    goal: '',
    password,
    privacyAccepted: true,
  });
  stage = 'coach-mark';
  await browserContext.clearCookies();
  await browserContext.addCookies((await owner.storageState()).cookies);
  await page.goto('/mensualidades');
  await page.getByRole('heading', { name: 'Alumno mensual QA', exact: true }).waitFor();
  let intention;
  const pattern = '**/students/*/monthly-payment';
  await page.route(pattern, async (route) => {
    intention = route.request().postDataJSON().requestId;
    const r = await route.fetch({ timeout: 6000 });
    assert.equal(r.status(), 200);
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Marcar pagado', exact: true }).click();
  await page.getByRole('alert').waitFor();
  await page.unroute(pattern);
  const retry = page.waitForRequest(
    (r) => r.method() === 'PUT' && r.url().endsWith('/monthly-payment'),
  );
  await page.getByRole('button', { name: 'Marcar pagado', exact: true }).click();
  assert.equal((await retry).postDataJSON().requestId, intention);
  await page.getByText('Mes guardado. Decide el acceso por separado.', { exact: true }).waitFor();
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int n FROM manual_monthly_events WHERE organization_id=$1 AND student_id=$2',
        [org, student.id],
      )
    ).rows[0].n,
    1,
  );
  report.checks.push('lost response retry preserves intention and one monthly pupil event');
  await metrics(page, 1440);
  await metrics(page, 320);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/evidencias/t14-control-alumnos-movil.png' });
  report.screenshots++;
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Pausar acceso', exact: true }).click();
  await page.getByText('Acceso actualizado sin borrar entrenamientos.', { exact: true }).waitFor();
  assert.equal((await pupil.get(root + '/portal')).status(), 403);
  const currentMonth = await page.getByLabel('Mes', { exact: true }).inputValue();
  const older = new Date(currentMonth + '-01T12:00:00Z');
  older.setUTCMonth(older.getUTCMonth() - 1);
  await page.getByLabel('Mes', { exact: true }).fill(older.toISOString().slice(0, 7));
  assert(await page.getByRole('button', { name: 'Marcar pendiente', exact: true }).isDisabled());
  await page.getByRole('button', { name: 'Consultar', exact: true }).click();
  await page.getByRole('button', { name: 'Marcar pagado', exact: true }).waitFor();
  report.checks.push('coach access decision is separate and earlier month has no copied payment');
  stage = 'account-and-register';
  await page.goto('/cuenta');
  await page.getByRole('heading', { name: 'Mi mensualidad', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Marcar pagado', exact: true }).count(), 0);
  await metrics(page, 320);
  await page.goto('/registro');
  await page.getByLabel('Nombre de tu estudio').waitFor();
  await page.getByLabel('Nombre de tu estudio').fill('Solo revisión QA');
  await page.getByLabel('Dirección de tu estudio').fill('qa-no-create');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByText('Habilitación manual', { exact: true }).waitFor();
  assert(!(await page.locator('main').textContent()).includes('14 días'));
  await metrics(page, 320);
  report.checks.push(
    'own monthly account read only and registration explains manual approval without automatic trial',
  );
  assert.deepEqual(report.pageErrors, []);
  assert(!report.budgetExceeded);
  report.status = 'passed';
} catch {
  report.status = 'failed';
  report.stage = stage;
  report.failure =
    'Inspect controlled stage locally; no credentials or response contents included.';
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  await browser?.close();
  for (const c of contexts) await c.dispose();
  await app?.close();
  if (vite) await new Promise((done) => vite.httpServer.close(done));
  await db?.end();
  await fixture.drop();
  report.isolatedDatabaseDropped = true;
  if (directory) {
    const p = resolve(directory);
    assert(
      p.startsWith(resolve('.local/test-storage') + sep) &&
        /^forma_test_[a-f0-9]{32}-/.test(basename(p)),
    );
    await rm(p, { recursive: true, force: true });
    report.isolatedStorageRemoved = true;
  }
  report.durationMs = Date.now() - started;
  await writeFile(
    'docs/evidencias/t14-control-visual.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
}
