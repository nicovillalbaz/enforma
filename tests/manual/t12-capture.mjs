/* global document, window, innerWidth, getComputedStyle, HTMLElement */
// Read-only continuation after spacing correction. Reuses cancelled synthetic history.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { buildApp } from '../../apps/api/src/app.ts';
assert.equal(process.env.FORMA_T12_LOCAL_QA, '1');
const db = new URL(process.env.DATABASE_ADMIN_URL);
assert(['localhost', '127.0.0.1'].includes(db.hostname) && db.pathname === '/forma');
const f = JSON.parse(await readFile('.local/t09-visual-fixture.json', 'utf8'));
assert(f.email.endsWith('@example.test') && f.pupilEmail.endsWith('@example.test'));
const baseURL = 'http://127.0.0.1:5182',
  root = `/v1/organizations/${f.orgId}/commerce`,
  report = {
    version: '0.12.0',
    scope: 'read-only-spacing-capture',
    browserInstances: 1,
    domainMutations: 0,
    pdfGenerations: 0,
    errors: [],
    viewportWidths: [],
    reusedEvidence: 't12-visual.json',
  },
  started = Date.now();
let api, vite, browser;
async function check(r) {
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
async function top(page) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
}
try {
  for (const name of ['t12-alumno-movil', 't12-contrato-coach-pc', 't12-resumen-pc'])
    await copyFile(`docs/evidencias/${name}.png`, `docs/evidencias/${name}-inicial.png`);
  api = await buildApp({
    origin: baseURL,
    cookieSecret: process.env.COOKIE_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    storageRoot: process.env.STORAGE_PATH,
    developmentMailbox: true,
  });
  await api.listen({ host: '127.0.0.1', port: 3005 });
  vite = await preview({
    configFile: 'apps/web/vite.config.ts',
    preview: {
      host: '127.0.0.1',
      port: 5182,
      strictPort: true,
      proxy: { '/v1': { target: 'http://127.0.0.1:3005', ws: true } },
    },
  });
  browser = await chromium.launch({ headless: true });
  for (const [role, email, width] of [
    ['owner', f.email, 1440],
    ['pupil', f.pupilEmail, 390],
  ]) {
    const ctx = await browser.newContext({
      baseURL,
      viewport: { width, height: role === 'owner' ? 960 : 844 },
    });
    const { token } = await check(await ctx.request.get('/v1/security/csrf'));
    await check(
      await ctx.request.post('/v1/auth/login', {
        headers: { 'x-csrf-token': token },
        data: { email, password: f.password },
      }),
    );
    const home = await check(await ctx.request.get(root)),
      contract = home.contracts.find((c) =>
        c.snapshot.name.startsWith('Acompañamiento mensual · QA T12'),
      );
    assert(contract);
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', (e) => report.errors.push(e.message));
    await page.goto(baseURL + '/servicios');
    await page
      .locator('.commerce-contract-card')
      .filter({ hasText: contract.snapshot.name })
      .click();
    await page.locator('.commerce-charge').first().waitFor();
    if (role === 'pupil') await page.setViewportSize({ width: 320, height: 844 });
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      padded: [...document.querySelectorAll('.commerce-workspace .ui-card')]
        .filter((e) => e.getBoundingClientRect().width > 0)
        .every((e) => parseFloat(getComputedStyle(e).paddingInlineStart) >= 16),
    }));
    assert(!metrics.overflow && metrics.padded, JSON.stringify(metrics));
    report.viewportWidths.push(role === 'owner' ? 1440 : 320);
    await page.setViewportSize({ width, height: role === 'owner' ? 960 : 844 });
    await top(page);
    await page.screenshot({
      path: `docs/evidencias/${role === 'owner' ? 't12-contrato-coach-pc' : 't12-alumno-movil'}.png`,
      fullPage: true,
    });
    if (role === 'owner') {
      await page
        .locator('.commerce-tabs')
        .getByRole('button', { name: 'Resumen', exact: true })
        .click();
      await page.locator('.commerce-summary').first().waitFor();
      await top(page);
      await page.screenshot({ path: 'docs/evidencias/t12-resumen-pc.png', fullPage: true });
    }
    await ctx.close();
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.failure = e.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await api?.close();
  if (vite) await new Promise((resolve) => vite.httpServer.close(resolve));
  report.durationMs = Date.now() - started;
  await writeFile('docs/evidencias/t12-capturas.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
