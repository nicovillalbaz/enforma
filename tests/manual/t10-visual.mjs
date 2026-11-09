/* global document, innerWidth, getComputedStyle */
// Opt-in local smoke check; one browser, two contexts, no traces, PDF or historical suites.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { buildApp } from '../../apps/api/src/app.ts';
if (process.env.FORMA_T10_LOCAL_QA !== '1') throw Error('Local QA opt-in required.');
const db = new URL(process.env.DATABASE_ADMIN_URL);
if (!['127.0.0.1', 'localhost'].includes(db.hostname) || db.pathname !== '/forma')
  throw Error('Synthetic local forma only.');
const f = JSON.parse(await readFile('.local/t09-visual-fixture.json', 'utf8'));
if (!f.email.endsWith('@example.test') || !f.pupilEmail.endsWith('@example.test'))
  throw Error('Synthetic fixture required.');
const baseURL = 'http://127.0.0.1:5180',
  root = `/v1/organizations/${f.orgId}/followup`,
  started = Date.now(),
  report = {
    version: '0.10.0',
    scope: 'synthetic-local-only',
    browserInstances: 1,
    pdfGenerations: 0,
    viewportWidths: [],
    errors: [],
    checks: [],
  };
const resume = process.env.FORMA_T10_RESUME === 'habit-builder';
if (resume) {
  const previous = JSON.parse(await readFile('docs/evidencias/t10-visual.json', 'utf8'));
  await copyFile('docs/evidencias/t10-visual.json', 'docs/evidencias/t10-visual-inicial.json');
  report.browserInstances = previous.browserInstances + 1;
  report.checks = previous.checks;
  report.viewportWidths = previous.viewportWidths;
  report.continuedFrom = 't10-visual-inicial.json';
}
let api,
  vite,
  browser,
  owner,
  student,
  stage = 'startup';
async function json(response) {
  assert.equal(response.status(), 200, await response.text());
  return response.json();
}
async function mutate(context, path, data, method = 'post') {
  const headers = {
    'x-csrf-token': (await json(await context.request.get('/v1/security/csrf'))).token,
  };
  return json(
    await context.request[method](path, { headers, ...(data === undefined ? {} : { data }) }),
  );
}
async function reflow(page, width) {
  await page.setViewportSize({ width, height: 900 });
  const r = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    viewport: innerWidth,
    inputs: [
      ...document.querySelectorAll(
        '.followup-workspace input:not([type=checkbox]),.followup-workspace select,.followup-workspace textarea',
      ),
    ]
      .filter((e) => e.getClientRects().length)
      .every((e) => parseFloat(getComputedStyle(e).fontSize) >= 16 || e.type === 'file'),
    nav: document.querySelectorAll('.bottom-nav a').length,
  }));
  assert(r.page <= r.viewport + 1, JSON.stringify(r));
  assert(r.inputs);
  assert(r.nav <= 5);
  report.viewportWidths.push(width);
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
  stage = 'reuse-synthetic-users';
  await mutate(owner, '/v1/auth/login', { email: f.email, password: f.password });
  await mutate(student, '/v1/auth/login', { email: f.pupilEmail, password: f.password });
  const me = await json(await owner.request.get('/v1/auth/me')),
    threadId = (
      await mutate(owner, root + '/threads', { studentId: f.pupilId, professionalId: me.user.id })
    ).id;
  const p = await owner.newPage(),
    s = await student.newPage();
  for (const page of [p, s]) page.on('pageerror', (e) => report.errors.push(e.message));
  p.setDefaultTimeout(10000);
  s.setDefaultTimeout(10000);
  const home = await json(await owner.request.get(root)),
    thread = home.threads.find((t) => t.id === threadId);
  assert(thread);
  if (!resume) {
    stage = 'owner-chat';
    await p.goto('/seguimiento');
    await p
      .locator('.followup-people > .followup-contact')
      .filter({ hasText: thread.studentName })
      .click();
    await p
      .getByLabel('Tu mensaje', { exact: true })
      .fill('¿Cómo fue tu sesión? Podemos revisar tus dudas por aquí.');
    await p.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await p.getByText('Mensaje guardado.', { exact: true }).waitFor();
    stage = 'mobile-chat-realtime';
    await s.goto('/seguimiento');
    await s
      .locator('.followup-people > .followup-contact')
      .filter({ hasText: thread.professionalName })
      .click();
    await s
      .getByLabel('Tu mensaje', { exact: true })
      .fill('La sesión fue bien. Dejé una nota para revisar esta semana.');
    await s.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();
    await p
      .getByText('La sesión fue bien. Dejé una nota para revisar esta semana.', { exact: true })
      .waitFor();
    report.checks.push('two-context chat and WebSocket refresh');
    for (const width of [320, 390, 768]) await reflow(s, width);
    await s.setViewportSize({ width: 390, height: 844 });
    await s.screenshot({
      path: 'docs/evidencias/t10-chat-movil.png',
      fullPage: true,
      scale: 'css',
    });
    await reflow(p, 1440);
    await p.screenshot({ path: 'docs/evidencias/t10-chat-pc.png', fullPage: true, scale: 'css' });
    stage = 'mobile-consent';
    await s.getByRole('button', { name: 'Privacidad', exact: true }).click();
    await s.getByLabel('Autorizo a este profesional', { exact: false }).check();
    await s.getByText('Preferencias guardadas.', { exact: true }).waitFor();
  } else {
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
  }
  stage = 'habit-builder';
  await p.getByRole('button', { name: 'Hábitos y check-ins', exact: true }).click();
  const habitName = 'Agua · registro libre T10 ' + randomUUID().slice(0, 4);
  await p.locator('summary').filter({ hasText: 'Asignar un hábito' }).click();
  await p.getByLabel('Nombre', { exact: true }).fill(habitName);
  await p.getByLabel('Tipo', { exact: false }).selectOption('water');
  await p.getByRole('button', { name: 'Asignar hábito', exact: true }).click();
  await p.getByRole('heading', { name: habitName, exact: true }).waitFor();
  report.checks.push('habit UI with optional target');
  stage = 'template-builder';
  await p.locator('summary').filter({ hasText: 'Plantillas y programación de check-ins' }).click();
  await p.getByRole('button', { name: 'Nueva plantilla', exact: true }).click();
  const formName = 'Tu semana · QA T10 ' + randomUUID().slice(0, 4);
  await p.getByLabel('Nombre de plantilla', { exact: true }).fill(formName);
  await p.getByRole('button', { name: 'Añadir campo', exact: true }).click();
  await p.getByLabel('Pregunta', { exact: true }).fill('¿Cómo te sentiste esta semana?');
  await p.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await p.getByText('Borrador guardado.', { exact: true }).waitFor();
  await p.getByRole('button', { name: 'Publicar versión guardada', exact: true }).click();
  await p.getByRole('button', { name: 'Programar para este alumno', exact: true }).click();
  await p.getByText('Check-ins programados.', { exact: true }).waitFor();
  report.checks.push('template save, publish and schedule through UI');
  stage = 'mobile-response';
  await s.getByRole('button', { name: 'Hábitos y check-ins', exact: true }).click();
  const habit = s.locator('.followup-habit').filter({ hasText: habitName });
  await habit.getByLabel('Registro · L', { exact: true }).fill('0');
  await habit.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  const task = s
    .locator('.followup-checkin')
    .filter({ hasText: formName })
    .filter({ has: s.getByRole('button', { name: 'Enviar check-in', exact: true }) });
  await task
    .getByLabel('¿Cómo te sentiste esta semana? (opcional)', { exact: true })
    .fill('Con energía; me gustaría revisar la técnica con calma.');
  await task.getByRole('button', { name: 'Enviar check-in', exact: true }).click();
  await task.getByText('Respondido', { exact: true }).waitFor();
  assert.equal(await habit.getByLabel('Registro · L', { exact: true }).inputValue(), '0');
  report.checks.push('pupil habit zero and check-in response');
  await reflow(s, 320);
  await s.setViewportSize({ width: 390, height: 844 });
  await s.screenshot({
    path: 'docs/evidencias/t10-seguimiento-movil.png',
    fullPage: true,
    scale: 'css',
  });
  stage = 'coach-review';
  await p.getByRole('button', { name: 'Actualizar', exact: true }).click();
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
  await reflow(s, 390);
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
  await writeFile('docs/evidencias/t10-visual.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
