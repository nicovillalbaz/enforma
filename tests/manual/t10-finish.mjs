/* global document, innerWidth */
// Only the unfinished response/review segment of the existing synthetic visual fixture.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { buildApp } from '../../apps/api/src/app.ts';
if (process.env.FORMA_T10_LOCAL_QA !== '1') throw Error('Local QA opt-in required.');
const db = new URL(process.env.DATABASE_ADMIN_URL);
if (!['127.0.0.1', 'localhost'].includes(db.hostname) || db.pathname !== '/forma')
  throw Error('Local forma only.');
const f = JSON.parse(await readFile('.local/t09-visual-fixture.json', 'utf8')),
  previous = JSON.parse(await readFile('docs/evidencias/t10-visual.json', 'utf8'));
assert.equal(previous.failedStage, 'mobile-response');
assert(f.email.endsWith('@example.test') && f.pupilEmail.endsWith('@example.test'));
await copyFile('docs/evidencias/t10-visual.json', 'docs/evidencias/t10-visual-respuesta.json');
const baseURL = 'http://127.0.0.1:5180',
  root = `/v1/organizations/${f.orgId}/followup`,
  report = {
    ...previous,
    browserInstances: previous.browserInstances + 1,
    continuedFrom: 't10-visual-respuesta.json',
    errors: [],
    checks: [...previous.checks],
  },
  started = Date.now();
delete report.failure;
delete report.failedStage;
let api,
  vite,
  browser,
  owner,
  student,
  stage = 'startup';
async function json(r) {
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
async function login(c, email) {
  const token = (await json(await c.request.get('/v1/security/csrf'))).token;
  await json(
    await c.request.post('/v1/auth/login', {
      headers: { 'x-csrf-token': token },
      data: { email, password: f.password },
    }),
  );
}
try {
  api = await buildApp({
    origin: baseURL,
    cookieSecret: process.env.COOKIE_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    storageRoot: process.env.STORAGE_PATH,
  });
  await api.listen({ host: '127.0.0.1', port: 3003 });
  vite = await preview({
    configFile: 'apps/web/vite.config.ts',
    preview: {
      host: '127.0.0.1',
      port: 5180,
      strictPort: true,
      proxy: { '/v1': { target: 'http://127.0.0.1:3003', ws: true } },
    },
  });
  browser = await chromium.launch({ headless: true });
  owner = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });
  student = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  await login(owner, f.email);
  await login(student, f.pupilEmail);
  const home = await json(await owner.request.get(root)),
    thread = home.threads.find((t) => t.studentId === f.pupilId);
  assert(thread);
  const data = await json(await student.request.get(root + '/threads/' + thread.id + '/tracking')),
    formName = previous.failure.match(/hasText: '([^']+)'/)[1],
    habitName = data.habits.find((h) => h.document.name.startsWith('Agua · registro libre T10'))
      .document.name;
  const p = await owner.newPage(),
    s = await student.newPage();
  for (const page of [p, s]) {
    page.setDefaultTimeout(10000);
    page.on('pageerror', (e) => report.errors.push(e.message));
  }
  await p.goto('/seguimiento');
  await p
    .locator('.followup-people > .followup-contact')
    .filter({ hasText: thread.studentName })
    .click();
  await s.goto('/seguimiento');
  await s
    .locator('.followup-people > .followup-contact')
    .filter({ hasText: thread.professionalName })
    .click();
  stage = 'mobile-response';
  await s.getByRole('button', { name: 'Hábitos y check-ins', exact: true }).click();
  const taskInfo = data.tasks.find((t) => t.document.name === formName && t.response);
  assert(taskInfo, 'Existing submitted response required; never replay submission.');
  const task = s
    .locator('.followup-checkin')
    .filter({ has: s.locator('[id^="' + taskInfo.id + '"]') });
  await task.getByText('Respondido', { exact: true }).waitFor();
  assert(
    Object.values(taskInfo.response.answers).includes(
      'Con energía; me gustaría revisar la técnica con calma.',
    ),
  );
  const habit = s.locator('.followup-habit').filter({ hasText: habitName });
  assert.equal(await habit.getByLabel('Registro · L', { exact: true }).inputValue(), '0');
  report.checks.push('pupil habit zero and check-in response');
  await s.setViewportSize({ width: 320, height: 900 });
  assert(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  report.viewportWidths.push(320);
  await s.setViewportSize({ width: 390, height: 844 });
  await s.screenshot({
    path: 'docs/evidencias/t10-seguimiento-movil.png',
    fullPage: true,
    scale: 'css',
  });
  stage = 'coach-review';
  await p.getByRole('button', { name: 'Hábitos y check-ins', exact: true }).click();
  const coachTask = p
    .locator('.followup-checkin')
    .filter({ hasText: formName })
    .filter({ has: p.getByLabel('Revisión compartida con el alumno', { exact: true }) });
  await coachTask
    .getByLabel('Revisión compartida con el alumno', { exact: true })
    .fill('Gracias. Revisamos la técnica en nuestra próxima sesión.');
  await coachTask
    .getByRole('button', { name: 'Guardar revisión y cerrar edición', exact: true })
    .click();
  await coachTask.getByText('Revisado', { exact: true }).waitFor();
  report.checks.push('coach review and locked answer');
  stage = 'reconnection';
  await s.getByRole('button', { name: 'Mensajes', exact: true }).click();
  await student.setOffline(true);
  await student.setOffline(false);
  await s.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await s.getByLabel('Tu mensaje', { exact: true }).fill('Conexión recuperada.');
  await s.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
  await s.getByText('Mensaje guardado.', { exact: true }).waitFor();
  report.checks.push('brief disconnect and recovery');
  await s.getByRole('button', { name: 'Activar tema oscuro', exact: true }).click();
  await s.screenshot({ path: 'docs/evidencias/t10-chat-oscuro.png', fullPage: true, scale: 'css' });
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.failedStage = stage;
  report.failure = String(e.message).slice(0, 1500);
  process.exitCode = 1;
} finally {
  await owner?.close();
  await student?.close();
  await browser?.close();
  await api?.close();
  if (vite) await new Promise((resolve) => vite.httpServer.close(resolve));
  report.durationMs = Date.now() - started;
  report.totalObservedMs = (previous.totalObservedMs ?? previous.durationMs) + report.durationMs;
  await writeFile('docs/evidencias/t10-visual.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
