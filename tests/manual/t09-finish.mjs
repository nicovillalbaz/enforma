// Targeted continuation of the existing synthetic fixture. Never recreates the builder flow.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import pg from 'pg';
import sharp from 'sharp';
import { buildApp } from '../../apps/api/src/app.ts';
import {
  claimDocumentJob,
  processDocumentJob,
  renderDocument,
} from '../../apps/worker/src/documents.ts';
if (process.env.FORMA_T09_LOCAL_QA !== '1') throw Error('Local QA opt-in required.');
const dbUrl = new URL(process.env.DATABASE_ADMIN_URL);
if (!['localhost', '127.0.0.1'].includes(dbUrl.hostname) || dbUrl.pathname !== '/forma')
  throw Error('Local forma only.');
const f = JSON.parse(await readFile('.local/t09-visual-fixture.json', 'utf8')),
  previous = JSON.parse(await readFile('docs/evidencias/t09-visual.json', 'utf8'));
await copyFile('docs/evidencias/t09-visual.json', 'docs/evidencias/t09-visual-inicial.json');
const baseURL = 'http://127.0.0.1:5180',
  worker = new pg.Pool({ connectionString: process.env.WORKER_DATABASE_URL, max: 1 }),
  root = `/v1/organizations/${f.orgId}`,
  nutrition = root + '/nutrition';
let api,
  vite,
  browser,
  owner,
  student,
  stage = 'startup';
const started = Date.now(),
  report = {
    scope: 'synthetic-local-only',
    version: '0.9.0',
    browserInstances: previous.browserInstances + 1,
    pdfGenerations: 0,
    viewportWidths: previous.viewportWidths,
    errors: [],
    professionalPhotoRead: previous.professionalPhotoRead,
    reusedBuilderEvidence: true,
    corrections: [
      'fresh CSRF for script API mutations after browser UI',
      'preserve null nutrients through API validation',
    ],
    initialRun: 't09-visual-inicial.json',
  };
const check = async (r, status = 200) => {
  assert.equal(r.status(), status, await r.text());
  return r.json();
};
try {
  api = await buildApp({
    origin: baseURL,
    cookieSecret: process.env.COOKIE_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    storageRoot: process.env.STORAGE_PATH,
    developmentMailbox: true,
  });
  await api.listen({ port: 3003, host: '127.0.0.1' });
  vite = await createServer({
    configFile: 'apps/web/vite.config.ts',
    server: {
      port: 5180,
      host: '127.0.0.1',
      strictPort: true,
      proxy: { '/v1': 'http://127.0.0.1:3003' },
    },
  });
  await vite.listen();
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
  let ownerHeaders = {
      'x-csrf-token': (await check(await owner.request.get('/v1/security/csrf'))).token,
    },
    studentHeaders = {
      'x-csrf-token': (await check(await student.request.get('/v1/security/csrf'))).token,
    };
  await check(
    await owner.request.post('/v1/auth/login', {
      headers: ownerHeaders,
      data: { email: f.email, password: f.password },
    }),
  );
  await check(
    await student.request.post('/v1/auth/login', {
      headers: studentHeaders,
      data: { email: f.pupilEmail, password: f.password },
    }),
  );
  stage = 'corrected-synthetic-version';
  let state = await check(
    await owner.request.get(nutrition + `?from=${f.today}&to=${f.today}&studentId=${f.pupilId}`),
  );
  assert(state.assignments.every((a) => a.studentName.includes('Ñandutí')));
  const unknown = state.foods.find((i) => i.document.name === 'Ingrediente sin datos · QA'),
    menu = state.menus.find((i) => i.document.name === 'Semana de prueba · Ñandutí');
  assert(unknown && menu);
  await check(
    await owner.request.put(nutrition + '/items/' + unknown.id, {
      headers: ownerHeaders,
      data: {
        kind: 'food',
        revision: unknown.revision,
        archived: false,
        document: {
          ...unknown.document,
          nutrients: { kcal: null, protein: null, carbs: null, fat: null },
        },
      },
    }),
  );
  await check(
    await owner.request.put(nutrition + '/items/' + menu.id, {
      headers: ownerHeaders,
      data: { kind: 'menu', revision: menu.revision, archived: false, document: menu.document },
    }),
  );
  const published = await check(
    await owner.request.post(nutrition + '/menus/' + menu.id + '/publish', {
      headers: ownerHeaders,
      data: { revision: menu.revision + 1 },
    }),
  );
  const old = state.assignments.find((a) => a.state === 'active');
  assert(old);
  await check(
    await owner.request.post(nutrition + '/assignments/' + old.id + '/cancel', {
      headers: ownerHeaders,
      data: {
        revision: old.revision,
        reason: 'Corrección de fuente sintética QA; conservar historial',
      },
    }),
  );
  const assignmentId = randomUUID();
  await check(
    await owner.request.put(nutrition + '/assignments/' + assignmentId, {
      headers: ownerHeaders,
      data: {
        versionId: published.versionId,
        studentId: f.pupilId,
        startsOn: old.startsOn,
        endsOn: old.endsOn,
      },
    }),
  );
  state = await check(await student.request.get(nutrition + `?from=${f.today}&to=${f.today}`));
  const assignment = state.assignments.find((a) => a.id === assignmentId);
  assert(assignment);
  assert.equal(
    assignment.snapshot.days[0].meals[1].recipe.ingredients[0].food.nutrients.kcal,
    null,
  );
  const weekday = new Date(f.today + 'T12:00:00Z').getUTCDay() || 7,
    meal = assignment.snapshot.days.find((d) => d.weekday === weekday).meals[0];
  const entry = await check(
    await student.request.post(nutrition + '/entries', {
      headers: studentHeaders,
      data: {
        assignmentId,
        eatenOn: f.today,
        mealId: meal.id,
        requestId: randomUUID(),
        revision: 0,
        state: 'eaten',
        choice: 'main',
        portions: 1.5,
        note: 'Registro ficticio; cantidad declarada, sin completar desde el plan.',
      },
    }),
  );
  const photoBytes = await sharp({
    create: { width: 32, height: 32, channels: 3, background: '#81c7a2' },
  })
    .png()
    .toBuffer();
  const photo = await check(
    await student.request.post(nutrition + '/entries/' + entry.id + '/photos', {
      headers: studentHeaders,
      data: {
        requestId: randomUUID(),
        dataUrl: 'data:image/png;base64,' + photoBytes.toString('base64'),
      },
    }),
    201,
  );
  await check(
    await owner.request.post(nutrition + '/entries/' + entry.id + '/comments', {
      headers: ownerHeaders,
      data: { requestId: randomUUID(), message: 'Comentario ficticio compartido con el alumno.' },
    }),
  );
  const photoUrl = nutrition + '/photos/' + photo.id + '/file';
  assert.equal((await owner.request.get(photoUrl)).status(), 200);
  stage = 'affected-screens-only';
  const page = await owner.newPage(),
    pupilPage = await student.newPage();
  for (const p of [page, pupilPage]) {
    p.setDefaultTimeout(8000);
    p.on('pageerror', (e) => report.errors.push(e.message));
  }
  await page.goto(baseURL + '/alimentacion');
  await page.locator('.nutrition-plan-heading .eyebrow').filter({ hasText: 'V2' }).waitFor();
  assert(
    await page
      .locator('.nutrition-summary')
      .getByText('Sin datos completos', { exact: true })
      .count(),
  );
  await page.screenshot({
    path: 'docs/evidencias/t09-seguimiento-pc.png',
    fullPage: true,
    scale: 'css',
  });
  await pupilPage.goto(baseURL + '/alimentacion');
  await pupilPage.locator('.nutrition-plan-heading .eyebrow').filter({ hasText: 'V2' }).waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await pupilPage.setViewportSize({ width, height: 844 });
    assert(
      await pupilPage.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
      'pupil overflow ' + width,
    );
  }
  await pupilPage.setViewportSize({ width: 390, height: 844 });
  await pupilPage.screenshot({
    path: 'docs/evidencias/t09-alumno-movil.png',
    fullPage: true,
    scale: 'css',
  });
  stage = 'pdf';
  ownerHeaders = {
    'x-csrf-token': (await check(await owner.request.get('/v1/security/csrf'))).token,
  };
  studentHeaders = {
    'x-csrf-token': (await check(await student.request.get('/v1/security/csrf'))).token,
  };
  const resource = (
    await check(
      await owner.request.post(root + '/resources', {
        headers: ownerHeaders,
        data: {
          requestId: randomUUID(),
          name: 'Menú de prueba · Ñandutí',
          description: 'Muestra ficticia T09',
          collectionId: null,
        },
      }),
      201,
    )
  ).resource;
  const version = await check(
    await owner.request.post(root + '/resources/' + resource.id + '/versions', {
      headers: ownerHeaders,
      data: { requestId: randomUUID(), kind: 'menu', studentId: f.pupilId, assignmentId },
    }),
    201,
  );
  const job = await claimDocumentJob(worker, f.orgId);
  assert(job);
  assert.equal(job.payload.versionId, version.versionId);
  let rendered;
  assert(
    await processDocumentJob(worker, job, {
      render: async (snapshot, storage) => {
        rendered = await renderDocument(snapshot, storage, browser);
        report.pdfGenerations++;
        return rendered;
      },
    }),
  );
  await writeFile('docs/evidencias/t09-menu-muestra.pdf', rendered.pdf);
  report.pdfBytes = rendered.pdf.length;
  await check(
    await owner.request.post(root + '/resources/' + resource.id + '/access', {
      headers: ownerHeaders,
      data: { studentId: f.pupilId, grant: true },
    }),
  );
  const link = await check(
    await student.request.post(
      root + '/resources/' + resource.id + '/versions/' + version.versionId + '/link',
      { headers: studentHeaders },
    ),
  );
  const read = await student.request.get(link.url);
  assert.equal(read.status(), 200);
  assert((await read.body()).subarray(0, 5).equals(Buffer.from('%PDF-')));
  report.studentPdfRead = 200;
  stage = 'revocation';
  await pupilPage.getByRole('button', { name: 'Activar tema oscuro' }).click();
  await pupilPage.screenshot({
    path: 'docs/evidencias/t09-alumno-oscuro.png',
    fullPage: true,
    scale: 'css',
  });
  await pupilPage.getByRole('button', { name: 'Privacidad', exact: true }).click();
  await pupilPage.getByLabel('Compartir fotos', { exact: true }).uncheck();
  await pupilPage.getByLabel('Compartir diario y comentarios').uncheck();
  const saved = pupilPage.waitForResponse(
    (r) =>
      r.request().method() === 'PUT' &&
      r.url().includes('/nutrition/privacy/') &&
      r.status() === 200,
  );
  await pupilPage.getByRole('button', { name: 'Guardar mis permisos' }).click();
  await saved;
  assert.equal((await owner.request.get(photoUrl)).status(), 404);
  assert.equal((await student.request.get(photoUrl)).status(), 200);
  report.revokedProfessionalPhotoRead = 404;
  report.selfRetainedPhotoRead = 200;
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  report.continuationDurationSeconds = Math.round((Date.now() - started) / 1000);
  report.checkedAt = new Date().toISOString();
  await writeFile('docs/evidencias/t09-visual.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  report.status = 'failed';
  report.stage = stage;
  report.failure = e.message;
  await writeFile('docs/evidencias/t09-visual.json', JSON.stringify(report, null, 2) + '\n');
  throw e;
} finally {
  await student?.close();
  await owner?.close();
  await browser?.close();
  await vite?.close();
  await api?.close();
  await worker.end();
}
