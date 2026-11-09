/* global document, window, innerWidth, getComputedStyle, HTMLElement */
// A single read-only Chromium pass. Registration stops before creating an account.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { buildApp } from '../../apps/api/src/app.ts';
assert.equal(process.env.FORMA_T13_LOCAL_QA, '1');
const db = new URL(process.env.DATABASE_ADMIN_URL);
assert(['localhost', '127.0.0.1'].includes(db.hostname) && db.pathname === '/forma');
const f = JSON.parse(await readFile('.local/t09-visual-fixture.json', 'utf8'));
assert(f.email.endsWith('@example.test') && f.pupilEmail.endsWith('@example.test'));
const baseURL = 'http://127.0.0.1:5183',
  root = `/v1/organizations/${f.orgId}`,
  started = Date.now(),
  report = {
    version: '0.13.0',
    scope: 'read-only-independent-coach',
    browserInstances: 1,
    domainMutations: 0,
    pdfGenerations: 0,
    checks: [],
    viewportWidths: [],
    themes: [],
    errors: [],
  };
let api,
  vite,
  browser,
  stage = 'startup';
async function check(r) {
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
async function login(ctx, email) {
  const { token } = await check(await ctx.request.get('/v1/security/csrf'));
  await check(
    await ctx.request.post('/v1/auth/login', {
      headers: { 'x-csrf-token': token },
      data: { email, password: f.password },
    }),
  );
}
async function top(page) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
}
async function metrics(page, width) {
  await page.setViewportSize({ width, height: width === 1440 ? 960 : 844 });
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    fields: [
      ...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]),select,textarea'),
    ]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .every((e) => parseFloat(getComputedStyle(e).fontSize) >= 16),
    actions: [...document.querySelectorAll('.coach-button,.more-link,.creator-signature')]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .every((e) => e.getBoundingClientRect().height >= 44),
  }));
  assert(!result.overflow && result.fields && result.actions, JSON.stringify({ width, ...result }));
  report.viewportWidths.push(width);
}
try {
  api = await buildApp({
    origin: baseURL,
    cookieSecret: process.env.COOKIE_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    storageRoot: process.env.STORAGE_PATH,
    developmentMailbox: true,
  });
  await api.listen({ host: '127.0.0.1', port: 3006 });
  vite = await preview({
    configFile: 'apps/web/vite.config.ts',
    preview: {
      host: '127.0.0.1',
      port: 5183,
      strictPort: true,
      proxy: { '/v1': { target: 'http://127.0.0.1:3006', ws: true } },
    },
  });
  browser = await chromium.launch({ headless: true });
  const owner = await browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } }),
    pupil = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } }),
    publicContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  await login(owner, f.email);
  await login(pupil, f.pupilEmail);
  const op = await owner.newPage(),
    pp = await pupil.newPage(),
    pub = await publicContext.newPage();
  for (const p of [op, pp, pub]) {
    p.setDefaultTimeout(8000);
    p.on('pageerror', (e) => report.errors.push(e.message));
  }
  stage = 'coach-home';
  const overview = await check(await owner.request.get(root + '/coach-start'));
  await op.goto(baseURL + '/');
  await op.locator('.coach-checklist li').first().waitFor();
  assert.equal(await op.locator('.coach-checklist li').count(), 5);
  assert.equal(
    await op.locator('.coach-metrics strong').first().textContent(),
    String(overview.activeStudents),
  );
  assert.equal(
    await op.locator('.page-footer .creator-signature').getAttribute('href'),
    '/informacion',
  );
  for (const width of [320, 390, 768, 1440]) await metrics(op, width);
  await top(op);
  await op.screenshot({ path: 'docs/evidencias/t13-inicio-coach-pc.png', fullPage: true });
  report.themes.push(await op.evaluate(() => document.documentElement.dataset.theme));
  report.checks.push('coach start matches server counts, five derived steps and NAVZ footer');
  stage = 'agenda';
  await op.goto(baseURL + '/agenda');
  await op.locator('.agenda-toolbar').waitFor();
  const agenda = await check(await owner.request.get(root + '/agenda'));
  if (agenda.professionals.length === 1) {
    assert.equal(await op.getByLabel('Profesional de agenda').count(), 0);
    await op.getByRole('button', { name: 'Nueva sesión', exact: true }).click();
    await op.locator('.agenda-editor').waitFor();
    assert.equal(await op.getByLabel('Profesional', { exact: true }).count(), 0);
  }
  report.checks.push('single-professional agenda avoids redundant selection');
  stage = 'more';
  await pp.goto(baseURL + '/alumno');
  await pp.locator('.mobile-context .more-options-link').click();
  await pp.locator('.more-group').first().waitFor();
  assert(new URL(pp.url()).pathname === '/mas');
  assert.equal(
    await pp
      .locator('.more-groups')
      .getByRole('link', { name: /Cuenta de la plataforma/ })
      .count(),
    0,
  );
  assert.equal(
    await pp
      .locator('.more-groups')
      .getByRole('link', { name: /Mi marca/ })
      .count(),
    0,
  );
  assert.equal(await pp.locator('.bottom-nav a').count(), 5);
  await metrics(pp, 320);
  await metrics(pp, 390);
  await top(pp);
  await pp.screenshot({ path: 'docs/evidencias/t13-mas-alumno-movil.png', fullPage: true });
  report.themes.push(await pp.evaluate(() => document.documentElement.dataset.theme));
  report.checks.push(
    'pupil grouped options preserve five destinations and exclude coach business management',
  );
  stage = 'information';
  await pp
    .locator('.more-groups')
    .getByRole('link', { name: /Información y ayuda/ })
    .click();
  await pp.getByRole('link', { name: '+595972995557', exact: true }).waitFor();
  assert.equal(
    await pp.getByRole('link', { name: '+595972995557', exact: true }).getAttribute('href'),
    'tel:+595972995557',
  );
  await metrics(pp, 320);
  await metrics(pp, 390);
  await top(pp);
  await pp.screenshot({ path: 'docs/evidencias/t13-informacion-movil.png', fullPage: true });
  await pub.goto(baseURL + '/informacion');
  await pub.getByRole('link', { name: '+595972995557', exact: true }).waitFor();
  assert.equal(await pub.getByRole('link', { name: 'Volver al acceso', exact: true }).count(), 1);
  assert((await pub.locator('main').textContent()).includes('Creado por NAVZ, +595972995557'));
  report.checks.push(
    'public and pupil information show exact signature and click-only telephone link',
  );
  stage = 'registration';
  await pub.goto(baseURL + '/registro');
  await pub.getByLabel('Tu nombre completo').fill('Coach QA T13');
  await pub
    .getByLabel('Correo electrónico', { exact: true })
    .fill('no-create-' + randomUUID().slice(0, 8) + '@example.test');
  await pub.locator('input[autocomplete="new-password"]').fill('No-account-created-2026!');
  await pub.getByRole('button', { name: 'Continuar', exact: true }).click();
  await pub.getByLabel('Nombre de tu estudio').waitFor();
  assert.equal(await pub.getByLabel('Tipo de organización').count(), 0);
  assert((await pub.locator('.independent-note').textContent()).includes('coach independiente'));
  await metrics(pub, 320);
  await metrics(pub, 390);
  assert.equal(
    await pub.locator('.creator-signature').textContent(),
    'Creado por NAVZ, +595972995557',
  );
  report.checks.push('registration has no gym selector and exact signature; no account submitted');
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.stage = stage;
  report.failure = e.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await api?.close();
  if (vite) await new Promise((resolve) => vite.httpServer.close(resolve));
  report.durationMs = Date.now() - started;
  await writeFile('docs/evidencias/t13-visual.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
