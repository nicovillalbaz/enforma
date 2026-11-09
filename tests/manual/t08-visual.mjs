// Opt-in local evidence only. One Chromium instance, one generated PDF, four viewport checks.
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
import { PrivateStorage } from '../../apps/api/src/storage.ts';
import { workoutFixture } from '../e2e/workout-fixture.ts';
import { freshSet } from '@forma/shared';
if (process.env.FORMA_T08_LOCAL_QA !== '1')
  throw Error('Opt-in: FORMA_T08_LOCAL_QA=1. Never run against a pilot.');
const dbUrl = new URL(process.env.DATABASE_ADMIN_URL);
if (!['localhost', '127.0.0.1'].includes(dbUrl.hostname) || dbUrl.pathname !== '/forma')
  throw Error('Only the local forma database is allowed.');
const baseURL = 'http://127.0.0.1:5180',
  admin = new pg.Pool({ connectionString: process.env.DATABASE_ADMIN_URL, max: 1 }),
  worker = new pg.Pool({ connectionString: process.env.WORKER_DATABASE_URL, max: 1 });
let api, vite, browser, owner, f, rendered;
const started = Date.now(),
  report = {
    scope: 'synthetic-local-only',
    version: '0.8.0',
    browserInstances: 1,
    pdfGenerations: 0,
    viewportWidths: [],
    errors: [],
  };
const check = async (response, status = 200) => {
  assert.equal(response.status(), status, await response.text());
  return response.json();
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
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  f = await workoutFixture(owner.request, browser, baseURL, 'Recursos T08');
  const orgId = f.root.split('/')[3];
  const row = (await admin.query('SELECT name FROM organizations WHERE id=$1', [orgId])).rows[0];
  assert.equal(row.name, 'Estudio de prueba T05');
  await admin.query('UPDATE organizations SET name=$1 WHERE id=$2', [
    'Ñandutí Training · QA T08',
    orgId,
  ]);
  await admin.query('UPDATE students SET display_name=$1 WHERE organization_id=$2 AND id=$3', [
    'Alumna Ñandutí · g̃uahẽ',
    orgId,
    f.student.id,
  ]);
  const storage = new PrivateStorage(process.env.STORAGE_PATH ?? '.local/storage'),
    logo = await sharp(
      Buffer.from(
        '<svg width="120" height="120" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="120" rx="25" fill="#071022"/><text x="60" y="83" text-anchor="middle" font-size="80" font-family="sans-serif" font-weight="700" fill="#19e7d0">N</text></svg>',
      ),
    )
      .webp()
      .toBuffer(),
    logoKey = await storage.put(logo, 'webp');
  const logoId = (
    await admin.query(
      "INSERT INTO organization_logo_assets(organization_id,storage_key,byte_size,mime_type)VALUES($1,$2,$3,'image/webp') RETURNING id",
      [orgId, logoKey, logo.length],
    )
  ).rows[0].id;
  await admin.query(
    'UPDATE organization_branding SET logo_asset_id=$1,primary_color=$2 WHERE organization_id=$3',
    [logoId, '#006a7a', orgId],
  );
  const original = (
    await check(await owner.request.get(f.root + '/program-versions/' + f.assignment.versionId))
  ).version;
  const exerciseId = original.snapshot.weeks[0].days[0].exercises[0].exerciseId;
  const document = {
    name: 'Fuerza · Ñandutí y g̃uahẽ',
    description:
      'Programa ficticio de tres semanas para comprobar marca, caracteres y paginación. No corresponde a una persona real.',
    isTemplate: false,
    weeks: Array.from({ length: 3 }, (_, week) => ({
      id: randomUUID(),
      name: ['Base y técnica', 'Progresión con calma', 'Consolidar el hábito'][week],
      days: [
        {
          id: randomUUID(),
          name: 'Fuerza y control',
          weekday: 1,
          notes: 'Antes de empezar, prepara tu espacio y revisa las indicaciones de tu coach.',
          exercises: Array.from({ length: 3 }, (_, n) => ({
            id: randomUUID(),
            exerciseId,
            notes: [
              'Mueve con control. Mantén una respiración cómoda.',
              'Descansa entre series y revisa tu postura.',
              'La carga es orientativa; registra lo que realmente hiciste.',
            ][n],
            sets: Array.from({ length: 4 }, () => ({
              ...freshSet(),
              weightKg: n === 0 ? 0 : n === 1 ? 32.5 : null,
            })),
          })),
        },
      ],
    })),
  };
  const created = (
    await check(
      await owner.request.post(f.root + '/programs', { headers: f.headers, data: { document } }),
      201,
    )
  ).program;
  const published = (
    await check(
      await owner.request.post(f.root + `/programs/${created.id}/publish`, {
        headers: f.headers,
        data: { revision: 1 },
      }),
    )
  ).version;
  const start = new Date(f.assignment.endsOn + 'T12:00:00Z');
  start.setUTCDate(start.getUTCDate() + 1);
  const assignment = (
    await check(
      await owner.request.post(f.root + `/program-versions/${published.id}/assignments`, {
        headers: f.headers,
        data: {
          studentIds: [f.student.id],
          startsOn: start.toISOString().slice(0, 10),
          requestId: randomUUID(),
        },
      }),
      201,
    )
  ).assignments[0];
  const collection = await check(
    await owner.request.post(f.root + '/resource-collections', {
      headers: f.headers,
      data: {
        name: 'Material para empezar',
        description: 'Recursos y documentos de demostración.',
        studentId: f.student.id,
        programVersionId: published.id,
      },
    }),
    201,
  );
  const resource = (
    await check(
      await owner.request.post(f.root + '/resources', {
        headers: f.headers,
        data: {
          requestId: randomUUID(),
          name: 'Tu rutina · tres semanas',
          description:
            'Tu programa en PDF con marca, instrucciones y series. Material ficticio para revisión.',
          collectionId: collection.id,
        },
      }),
      201,
    )
  ).resource;
  await check(
    await owner.request.post(f.root + `/resources/${resource.id}/versions`, {
      headers: f.headers,
      data: {
        requestId: randomUUID(),
        kind: 'routine',
        studentId: f.student.id,
        assignmentId: assignment.id,
      },
    }),
    201,
  );
  const job = await claimDocumentJob(worker, orgId);
  assert(job);
  assert(
    await processDocumentJob(worker, job, {
      render: async (snapshot, store) => {
        rendered = await renderDocument(snapshot, store, browser);
        report.pdfGenerations++;
        return rendered;
      },
    }),
  );
  assert.equal(report.pdfGenerations, 1);
  await writeFile('docs/evidencias/t08-rutina-muestra.pdf', rendered.pdf);
  report.pdfBytes = rendered.pdf.length;
  report.chromiumVersion = browser.version();
  const page = await owner.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.goto(baseURL + '/recursos');
  await page.getByRole('heading', { name: 'Todo tu material, en un lugar.' }).waitFor();
  await page.locator('.resource-card').filter({ hasText: 'Tu rutina · tres semanas' }).click();
  await page.getByLabel('Alumno con acceso').selectOption(f.student.id);
  await page.getByRole('button', { name: 'Conceder acceso', exact: true }).click();
  await page.locator('.resource-grants').getByText('Alumna Ñandutí · g̃uahẽ').waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= globalThis.innerWidth),
      `overflow at ${width}`,
    );
    assert(
      Number(
        await page
          .locator('.resource-detail input')
          .first()
          .evaluate((e) => parseFloat(globalThis.getComputedStyle(e).fontSize)),
      ) >= 16,
    );
    assert((await page.locator('.bottom-nav a').count()) <= 5);
    report.viewportWidths.push(width);
  }
  await page.screenshot({
    path: 'docs/evidencias/t08-recursos-pc.png',
    fullPage: true,
    scale: 'css',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'docs/evidencias/t08-recursos-movil.png',
    fullPage: true,
    scale: 'css',
  });
  const pupil = await f.context.newPage();
  pupil.setDefaultTimeout(8000);
  pupil.on('pageerror', (e) => report.errors.push(e.message));
  await pupil.goto(baseURL + '/recursos');
  await pupil.locator('.resource-card').click();
  assert.equal(await pupil.getByRole('button', { name: 'Nuevo recurso' }).count(), 0);
  await pupil.getByRole('button', { name: 'Preparar acceso privado' }).click();
  const href = await pupil.getByRole('link', { name: 'Abrir archivo' }).getAttribute('href');
  const read = await f.context.request.get(href);
  assert.equal(read.status(), 200);
  assert.equal(read.headers()['cache-control'], 'private, no-store');
  assert((await read.body()).subarray(0, 5).equals(Buffer.from('%PDF-')));
  report.studentRead = 200;
  await pupil.screenshot({
    path: 'docs/evidencias/t08-alumno-movil.png',
    fullPage: true,
    scale: 'css',
  });
  await page.getByRole('button', { name: 'Revocar acceso', exact: true }).click();
  await page.locator('.resource-grants li').waitFor({ state: 'detached' });
  const denied = await f.context.request.get(href);
  assert.equal(denied.status(), 404);
  report.revokedRead = 404;
  await pupil.reload();
  assert.equal(await pupil.locator('.resource-card').count(), 0);
  await page.getByRole('button', { name: 'Activar tema oscuro' }).click();
  await page.screenshot({
    path: 'docs/evidencias/t08-recursos-oscuro.png',
    fullPage: true,
    scale: 'css',
  });
  assert.deepEqual(report.errors, []);
  report.durationSeconds = Math.round((Date.now() - started) / 1000);
  report.checkedAt = new Date().toISOString();
  report.status = 'passed';
  await writeFile('docs/evidencias/t08-visual.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await f?.context.close();
  await owner?.close();
  await browser?.close();
  await vite?.close();
  await api?.close();
  await worker.end();
  await admin.end();
}
