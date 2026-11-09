// Opt-in local QA: one browser shared by UI and one PDF. No traces/video/matrix.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
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
if (process.env.FORMA_T09_LOCAL_QA !== '1')
  throw Error('Opt-in local QA only: FORMA_T09_LOCAL_QA=1.');
const dbUrl = new URL(process.env.DATABASE_ADMIN_URL);
if (!['localhost', '127.0.0.1'].includes(dbUrl.hostname) || dbUrl.pathname !== '/forma')
  throw Error('Only local forma is allowed.');
const baseURL = 'http://127.0.0.1:5180',
  worker = new pg.Pool({ connectionString: process.env.WORKER_DATABASE_URL, max: 1 });
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
    browserInstances: 1,
    pdfGenerations: 0,
    viewportWidths: [],
    errors: [],
  };
const check = async (r, status = 200) => {
  assert.equal(r.status(), status, await r.text());
  return r.json();
};
try {
  await mkdir('docs/evidencias', { recursive: true });
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
  stage = 'synthetic-fixture';
  const suffix = randomUUID().slice(0, 8),
    password = 'Nutrition-local-QA-2026!',
    email = `coach-food-${suffix}@example.test`,
    pupilEmail = `pupil-food-${suffix}@example.test`;
  const ownerHeaders = {
    'x-csrf-token': (await check(await owner.request.get('/v1/security/csrf'))).token,
  };
  const registered = await check(
    await owner.request.post('/v1/auth/register-coach', {
      headers: ownerHeaders,
      data: {
        fullName: 'Profesional de prueba T09',
        email,
        password,
        name: 'Ñandutí · QA Alimentación',
        slug: 'comidas-' + suffix,
        kind: 'coach',
        accent: '#005ea8',
        plan: 'basic',
        privacyAccepted: true,
      },
    }),
    201,
  );
  const orgId = registered.organizationId,
    root = `/v1/organizations/${orgId}`,
    nutrition = root + '/nutrition';
  const mails = (await check(await owner.request.get('/v1/development/emails'))).emails;
  const verification =
    mails.find((m) => m.kind === 'email.verification' && m.to === email) ??
    mails.find((m) => m.kind === 'email.verification');
  await check(
    await owner.request.post('/v1/auth/verify-email', {
      headers: ownerHeaders,
      data: { token: new URL(verification.url).searchParams.get('token') },
    }),
  );
  const user = (await check(await owner.request.get('/v1/auth/me'))).user;
  const pupil = (
    await check(
      await owner.request.post(root + '/students', {
        headers: ownerHeaders,
        data: {
          displayName: 'Alumna Ñandutí · g̃uahẽ',
          email: pupilEmail,
          goal: 'Seguimiento ficticio de comidas',
        },
      }),
      201,
    )
  ).student;
  const invitation = (
    await check(
      await owner.request.post(root + '/students/' + pupil.id + '/invitation', {
        headers: ownerHeaders,
      }),
    )
  ).url;
  const studentHeaders = {
    'x-csrf-token': (await check(await student.request.get('/v1/security/csrf'))).token,
  };
  await check(
    await student.request.post('/v1/invitations/accept', {
      headers: studentHeaders,
      data: {
        token: new URL(invitation).searchParams.get('token'),
        fullName: pupil.displayName,
        goal: pupil.goal,
        password,
        privacyAccepted: true,
      },
    }),
  );
  await check(
    await owner.request.put(nutrition + '/professionals/' + user.id, {
      headers: ownerHeaders,
      data: {
        revision: 0,
        enabled: true,
        qualification: 'Referencia ficticia de QA; no es una acreditación real',
      },
    }),
  );
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const foodIds = [randomUUID(), randomUUID()],
    recipeIds = [randomUUID(), randomUUID()];
  for (let i = 0; i < 2; i++) {
    await check(
      await owner.request.put(nutrition + '/items/' + foodIds[i], {
        headers: ownerHeaders,
        data: {
          kind: 'food',
          revision: 0,
          archived: false,
          document: {
            name: i ? 'Ingrediente sin datos · QA' : 'Ingrediente con datos · QA',
            source: 'Fuente sintética para verificar la aplicación',
            reference: 'QA-T09; valores ficticios',
            license: 'Fixture interno, no usar en planes reales',
            checkedOn: today,
            nutrients: {
              kcal: i ? null : 200,
              protein: i ? null : 0,
              carbs: i ? null : 25,
              fat: i ? null : 10,
            },
            allergensKnown: !i,
            allergens: [],
          },
        },
      }),
    );
    await check(
      await owner.request.put(nutrition + '/items/' + recipeIds[i], {
        headers: ownerHeaders,
        data: {
          kind: 'recipe',
          revision: 0,
          archived: false,
          document: {
            name: i ? 'Receta con datos incompletos' : 'Bowl de prueba · Ñandutí',
            instructions:
              'Preparación ficticia para comprobar fuentes, porciones y reflujo. No es una recomendación de alimentación.',
            servings: 2,
            ingredients: [{ foodId: foodIds[i], grams: 150 }],
          },
        },
      }),
    );
  }
  await writeFile(
    '.local/t09-visual-fixture.json',
    JSON.stringify(
      { orgId, email, pupilEmail, password, pupilId: pupil.id, today, recipeIds },
      null,
      2,
    ),
  );
  stage = 'menu-builder-ui';
  const page = await owner.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.goto(baseURL + '/alimentacion');
  await page.getByRole('heading', { name: 'Comidas con un plan claro.' }).waitFor();
  await page.getByRole('button', { name: 'Menús', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo menú', exact: true }).click();
  await page.getByLabel('Nombre del menú', { exact: true }).fill('Semana de prueba · Ñandutí');
  await page
    .getByLabel('Indicaciones generales')
    .fill('Siete días ficticios. Datos conocidos y ausentes se mantienen separados. g̃uahẽ.');
  let meal = page.locator('.nutrition-meal-edit').first();
  await meal.getByLabel('Momento / nombre').fill('Desayuno');
  await meal.getByLabel('Receta principal').selectOption(recipeIds[0]);
  await meal.getByLabel('Sustitución de receta').selectOption(recipeIds[1]);
  await page.getByRole('button', { name: 'Añadir comida', exact: true }).click();
  meal = page.locator('.nutrition-meal-edit').nth(1);
  await meal.getByLabel('Momento / nombre').fill('Almuerzo');
  await meal.getByLabel('Receta principal').selectOption(recipeIds[1]);
  await meal.getByLabel('Sustitución de receta').selectOption(recipeIds[0]);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Copiar día al resto' }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
      'builder overflow ' + width,
    );
    assert(
      await page
        .locator(
          '.nutrition-editor input:not([type="checkbox"]),.nutrition-editor select,.nutrition-editor textarea',
        )
        .evaluateAll((els) =>
          els.every((e) => parseFloat(globalThis.getComputedStyle(e).fontSize) >= 16),
        ),
      'input fonts',
    );
    assert((await page.locator('.bottom-nav a').count()) <= 5);
    report.viewportWidths.push(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'docs/evidencias/t09-constructor-movil.png',
    fullPage: true,
    scale: 'css',
  });
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await page.getByText('Ficha guardada.', { exact: true }).waitFor();
  const card = page
    .locator('.nutrition-catalog-card')
    .filter({ hasText: 'Semana de prueba · Ñandutí' });
  await card.getByRole('button', { name: 'Publicar', exact: true }).click();
  await page.getByText('Versión publicada. Ya puedes asignarla.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Asignar menú', exact: true }).click();
  await page
    .getByText('Menú asignado. La semana se repite por día de la semana.', { exact: true })
    .waitFor();
  let state = await check(await student.request.get(nutrition + `?from=${today}&to=${today}`));
  const assignment = state.assignments[0];
  assert(assignment);
  assert.equal(assignment.snapshot.days.length, 7);
  assert(assignment.snapshot.days.every((d) => d.meals.length === 2));
  await page.getByRole('button', { name: 'Seguimiento', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole('heading', { name: 'Semana de prueba · Ñandutí', exact: true }).waitFor();
  assert(await page.getByText('Privado', { exact: true }).count());
  stage = 'student-ui';
  const pupilPage = await student.newPage();
  pupilPage.setDefaultTimeout(8000);
  pupilPage.on('pageerror', (e) => report.errors.push(e.message));
  await pupilPage.goto(baseURL + '/alimentacion');
  await pupilPage.getByRole('button', { name: 'Privacidad', exact: true }).click();
  await pupilPage.getByLabel('Acepto guardar mi diario', { exact: false }).check();
  await pupilPage.getByLabel('Acepto guardar fotos opcionales').check();
  await pupilPage.getByLabel('Compartir diario y comentarios').check();
  await pupilPage.getByLabel('Compartir fotos', { exact: true }).check();
  const privacySaved = pupilPage.waitForResponse(
    (r) => r.request().method() === 'PUT' && r.url().includes('/nutrition/privacy/'),
  );
  await pupilPage.getByRole('button', { name: 'Guardar mis permisos' }).click();
  assert.equal((await privacySaved).status(), 200);
  await pupilPage.getByRole('button', { name: 'Mi menú', exact: true }).click();
  await pupilPage
    .getByRole('button', { name: 'Registrar esta comida', exact: true })
    .first()
    .click();
  await pupilPage.getByLabel('Porciones realmente consumidas').fill('1.5');
  await pupilPage
    .getByLabel('Nota (opcional)')
    .fill('Registro ficticio; cantidad declarada, sin completar desde el plan.');
  await pupilPage.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await pupilPage.getByText('Registro guardado.', { exact: true }).waitFor();
  const photo = await sharp({
    create: { width: 32, height: 32, channels: 3, background: '#81c7a2' },
  })
    .png()
    .toBuffer();
  await pupilPage
    .locator('.nutrition-upload input')
    .first()
    .setInputFiles({ name: 'comida-qa.png', mimeType: 'image/png', buffer: photo });
  await pupilPage.getByText('Foto privada guardada.', { exact: true }).waitFor();
  assert(
    await pupilPage.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  );
  await pupilPage.screenshot({
    path: 'docs/evidencias/t09-alumno-movil.png',
    fullPage: true,
    scale: 'css',
  });
  state = await check(await student.request.get(nutrition + `?from=${today}&to=${today}`));
  assert.equal(state.entries[0].portions, 1.5);
  assert.equal(state.entries[0].photos.length, 1);
  const photoUrl = state.entries[0].photos[0].url;
  assert.equal((await owner.request.get(photoUrl)).status(), 200);
  report.professionalPhotoRead = 200;
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
  await page
    .getByLabel('Comentario para el alumno')
    .first()
    .fill('Comentario de prueba compartido con el alumno.');
  await page.getByRole('button', { name: 'Compartir comentario', exact: true }).first().click();
  await page.getByText('Comentario compartido con el alumno.', { exact: true }).waitFor();
  await page.screenshot({
    path: 'docs/evidencias/t09-seguimiento-pc.png',
    fullPage: true,
    scale: 'css',
  });
  stage = 'menu-pdf';
  ownerHeaders['x-csrf-token'] = (await check(await owner.request.get('/v1/security/csrf'))).token;
  studentHeaders['x-csrf-token'] = (
    await check(await student.request.get('/v1/security/csrf'))
  ).token;
  const request = await check(
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
    ),
    resourceId = request.resource.id;
  const version = await check(
    await owner.request.post(root + '/resources/' + resourceId + '/versions', {
      headers: ownerHeaders,
      data: {
        requestId: randomUUID(),
        kind: 'menu',
        studentId: pupil.id,
        assignmentId: assignment.id,
      },
    }),
    201,
  );
  const job = await claimDocumentJob(worker, orgId);
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
    await owner.request.post(root + '/resources/' + resourceId + '/access', {
      headers: ownerHeaders,
      data: { studentId: pupil.id, grant: true },
    }),
  );
  const link = await check(
    await student.request.post(
      root + '/resources/' + resourceId + '/versions/' + version.versionId + '/link',
      { headers: studentHeaders },
    ),
  );
  const file = await student.request.get(link.url ?? link.href);
  assert.equal(file.status(), 200);
  assert((await file.body()).subarray(0, 5).equals(Buffer.from('%PDF-')));
  report.studentPdfRead = 200;
  stage = 'revocation-ui';
  await pupilPage.getByRole('button', { name: 'Activar tema oscuro' }).click();
  await pupilPage.screenshot({
    path: 'docs/evidencias/t09-alumno-oscuro.png',
    fullPage: true,
    scale: 'css',
  });
  await pupilPage.getByRole('button', { name: 'Privacidad', exact: true }).click();
  await pupilPage.getByLabel('Compartir fotos', { exact: true }).uncheck();
  await pupilPage.getByLabel('Compartir diario y comentarios').uncheck();
  const revoked = pupilPage.waitForResponse(
    (r) => r.request().method() === 'PUT' && r.url().includes('/nutrition/privacy/'),
  );
  await pupilPage.getByRole('button', { name: 'Guardar mis permisos' }).click();
  assert.equal((await revoked).status(), 200);
  assert.equal((await owner.request.get(photoUrl)).status(), 404);
  assert.equal((await student.request.get(photoUrl)).status(), 200);
  report.revokedProfessionalPhotoRead = 404;
  report.selfRetainedPhotoRead = 200;
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  report.durationSeconds = Math.round((Date.now() - started) / 1000);
  report.checkedAt = new Date().toISOString();
  await writeFile('docs/evidencias/t09-visual.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  report.status = 'failed';
  report.durationSeconds = Math.round((Date.now() - started) / 1000);
  report.checkedAt = new Date().toISOString();
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
