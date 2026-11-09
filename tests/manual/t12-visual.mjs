/* global document, innerWidth, getComputedStyle */
// One local Chromium instance. Synthetic sales only; never sends mail or moves money.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
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
  started = Date.now(),
  report = {
    version: '0.12.0',
    scope: 'synthetic-local-only',
    browserInstances: 1,
    pdfGenerations: 0,
    checks: [],
    viewportWidths: [],
    errors: [],
  };
let api,
  vite,
  browser,
  owner,
  pupil,
  services = [],
  contracts = [],
  prospectId,
  stage = 'startup';
async function check(r) {
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
const get = (ctx, path) => ctx.request.get(path).then(check);
async function call(ctx, path, body, method = 'POST') {
  const { token } = await get(ctx, '/v1/security/csrf');
  return check(
    await ctx.request.fetch(path, { method, headers: { 'x-csrf-token': token }, data: body }),
  );
}
async function metrics(page, width) {
  await page.setViewportSize({ width, height: width === 1440 ? 960 : 844 });
  const r = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    fields: [
      ...document.querySelectorAll(
        '.commerce-workspace input:not([type=checkbox]),.commerce-workspace select,.commerce-workspace textarea',
      ),
    ]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .every((e) => parseFloat(getComputedStyle(e).fontSize) >= 16),
    actions: [
      ...document.querySelectorAll('.commerce-workspace .commerce-button,.commerce-tabs button'),
    ]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .every((e) => e.getBoundingClientRect().height >= 44),
  }));
  assert(!r.overflow && r.fields && r.actions, JSON.stringify({ width, ...r }));
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
  owner = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  pupil = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  for (const [ctx, email] of [
    [owner, f.email],
    [pupil, f.pupilEmail],
  ])
    await call(ctx, '/v1/auth/login', { email, password: f.password });
  const { today } = await get(owner, root),
    suffix = randomUUID().slice(0, 5);
  stage = 'fixture';
  for (const [kind, name, priceMinor, sessions] of [
    ['membership', 'Acompañamiento mensual', 180000, 0],
    ['package', 'Paquete de fuerza', 320000, 8],
  ]) {
    const id = randomUUID(),
      document = {
        name: `${name} · QA T12 ${suffix}`,
        description: 'Servicio ficticio para revisión móvil y PC.',
        kind,
        currency: 'PYG',
        priceMinor,
        validityDays: 30,
        sessions,
        capacity: 0,
        archived: false,
      };
    await call(
      owner,
      root + '/services/' + id,
      { requestId: randomUUID(), revision: 0, document },
      'PUT',
    );
    services.push({ id, document });
  }
  const packageId = randomUUID();
  await call(
    owner,
    root + '/contracts/' + packageId,
    {
      requestId: randomUUID(),
      document: {
        serviceId: services[1].id,
        serviceRevision: 1,
        studentId: f.pupilId,
        startsOn: today,
        renewalOf: null,
        installments: [{ dueOn: today, amountMinor: 320000 }],
      },
    },
    'PUT',
  );
  contracts.push(packageId);
  const op = await owner.newPage(),
    pp = await pupil.newPage();
  for (const p of [op, pp]) {
    p.setDefaultTimeout(8000);
    p.on('pageerror', (e) => report.errors.push(e.message));
  }
  op.on('dialog', (d) => d.accept());
  stage = 'sale-ui';
  await op.goto(baseURL + '/servicios');
  await op
    .locator('.commerce-contract-card')
    .filter({ hasText: services[1].document.name })
    .waitFor();
  await op.getByRole('button', { name: 'Nueva venta', exact: true }).click();
  await op.getByLabel('Servicio para vender').selectOption(services[0].id);
  await op.getByLabel('Alumno del servicio').selectOption(f.pupilId);
  await op.getByRole('button', { name: 'Continuar a cuotas', exact: true }).click();
  await op.getByRole('button', { name: 'Dividir en 2 cuotas', exact: true }).click();
  assert.equal(await op.locator('.commerce-installment').count(), 2);
  await op.getByRole('button', { name: 'Confirmar venta', exact: true }).click();
  await op
    .locator('.commerce-contract-detail h2')
    .filter({ hasText: services[0].document.name })
    .waitFor();
  const sold = (await get(owner, root)).contracts.find((c) => c.serviceId === services[0].id);
  assert(sold);
  contracts.push(sold.id);
  report.checks.push('mobile two-step sale with two exact installments');
  stage = 'partial-payment';
  await op.getByRole('button', { name: 'Registrar pago de cuota 1', exact: true }).click();
  await op.getByLabel('Importe del movimiento (PYG)').fill('45000');
  await op.getByLabel('Referencia única del pago').fill('T12-QA-' + suffix);
  await metrics(op, 320);
  await metrics(op, 390);
  await op.getByRole('button', { name: 'Confirmar movimiento', exact: true }).click();
  await op.locator('.commerce-payment strong').filter({ hasText: 'PYG 45.000' }).waitFor();
  const detail = await get(owner, root + '/contracts/' + sold.id);
  assert.equal(detail.contract.balanceMinor, 135000);
  assert.equal(detail.charges.length, 2);
  assert.equal(detail.charges[0].balanceMinor, 45000);
  report.checks.push('partial payment updates quota and contract balances');
  for (const width of [768, 1440]) await metrics(op, width);
  await op.screenshot({ path: 'docs/evidencias/t12-contrato-coach-pc.png', fullPage: true });
  stage = 'pupil';
  await pp.goto(baseURL + '/servicios');
  await pp
    .locator('.commerce-contract-card')
    .filter({ hasText: services[0].document.name })
    .click();
  await pp.locator('.commerce-payment strong').filter({ hasText: 'PYG 45.000' }).waitFor();
  assert.equal(
    await pp.getByRole('button', { name: 'Registrar pago de cuota 1', exact: true }).count(),
    0,
  );
  await metrics(pp, 320);
  await metrics(pp, 390);
  await pp.screenshot({ path: 'docs/evidencias/t12-alumno-movil.png', fullPage: true });
  report.checks.push('pupil sees own service and payment without management actions');
  stage = 'crm';
  await op
    .locator('.commerce-tabs')
    .getByRole('button', { name: 'Prospectos', exact: true })
    .click();
  await op.getByRole('button', { name: 'Nuevo prospecto', exact: true }).click();
  await op.getByLabel('Nombre del prospecto').fill('Contacto comercial QA T12 ' + suffix);
  await op.getByLabel('Correo del prospecto').fill(f.pupilEmail);
  await op.getByLabel('Origen del prospecto').fill('Referencia ficticia');
  await op.getByLabel('Próxima acción', { exact: true }).fill('Llamada acordada de prueba');
  await op.getByRole('button', { name: 'Guardar prospecto', exact: true }).click();
  const card = op
    .locator('.commerce-prospect')
    .filter({ hasText: 'Contacto comercial QA T12 ' + suffix });
  await card.waitFor();
  prospectId = (await get(owner, root + '/prospects')).prospects.find((p) =>
    p.name.includes(suffix),
  ).id;
  await card.getByRole('button', { name: 'Convertir a alumno', exact: true }).click();
  await card.getByText('Convertido', { exact: true }).waitFor();
  const converted = (await get(owner, root + '/prospects')).prospects.find(
    (p) => p.id === prospectId,
  );
  assert.equal(converted.studentId, f.pupilId);
  report.checks.push('CRM conversion links existing pupil without duplication');
  stage = 'summary';
  await op.locator('.commerce-tabs').getByRole('button', { name: 'Resumen', exact: true }).click();
  await op.locator('.commerce-summary').first().waitFor();
  assert.equal(await op.locator('.commerce-summary').count(), 3);
  const csv = await owner.request.get(root + `/reports?from=${today}&to=${today}&csv=1`);
  assert.equal(csv.status(), 200);
  assert((await csv.text()).includes('grossMinor'));
  await op.screenshot({ path: 'docs/evidencias/t12-resumen-pc.png', fullPage: true });
  report.checks.push('three separate currencies and authorized aggregate CSV');
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.stage = stage;
  report.failure = e.message;
  process.exitCode = 1;
} finally {
  try {
    for (const id of contracts) {
      let d = await get(owner, root + '/contracts/' + id);
      for (const h of d.charges)
        for (const p of h.payments)
          if (!p.returnedMinor)
            await call(owner, root + '/payments/' + p.id + '/return', {
              requestId: randomUUID(),
              amountMinor: p.amountMinor,
              returnedOn: (await get(owner, root)).today,
              kind: 'correction',
              reason: 'Cierre de pago ficticio QA T12; no hubo movimiento real.',
            });
      d = await get(owner, root + '/contracts/' + id);
      for (const h of d.charges)
        if (h.balanceMinor)
          await call(owner, root + '/charges/' + h.id + '/adjust', {
            requestId: randomUUID(),
            amountMinor: -h.balanceMinor,
            reason: 'Cierre de deuda ficticia QA T12; conservar historial.',
          });
      if (!d.contract.cancelled)
        await call(owner, root + '/contracts/' + id + '/cancel', {
          requestId: randomUUID(),
          revision: d.contract.revision,
          reason: 'Cierre de contrato ficticio QA T12 tras revisión visual.',
        });
    }
    const current = await get(owner, root);
    for (const s of services) {
      const saved = current.services.find((x) => x.id === s.id);
      if (saved)
        await call(
          owner,
          root + '/services/' + s.id,
          {
            requestId: randomUUID(),
            revision: saved.revision,
            document: { ...s.document, archived: true },
          },
          'PUT',
        );
    }
    if (prospectId) {
      const p = (await get(owner, root + '/prospects')).prospects.find((x) => x.id === prospectId);
      if (p && p.stage !== 'erased')
        await call(owner, root + '/prospects/' + p.id + '/erase', {
          requestId: randomUUID(),
          revision: p.revision,
        });
    }
    report.fixtureCleaned = true;
  } catch (e) {
    report.cleanupError = e.message;
    process.exitCode = 1;
  }
  await browser?.close();
  await api?.close();
  if (vite) await new Promise((resolve) => vite.httpServer.close(resolve));
  report.durationMs = Date.now() - started;
  await writeFile('docs/evidencias/t12-visual.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
