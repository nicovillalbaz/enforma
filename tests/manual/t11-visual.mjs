/* global document, innerWidth, getComputedStyle */
// One bounded Chromium pass, synthetic localhost fixture, no PDF or external delivery.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview } from 'vite';
import pg from 'pg';
import { buildApp } from '../../apps/api/src/app.ts';
import { agendaTick } from '../../apps/worker/src/agenda.ts';
import { dateShift, zonedCandidates } from '../../packages/shared/src/agenda.ts';
assert.equal(process.env.FORMA_T11_LOCAL_QA, '1');
const db = new URL(process.env.DATABASE_ADMIN_URL);
assert(['localhost', '127.0.0.1'].includes(db.hostname) && db.pathname === '/forma');
const f = JSON.parse(await readFile('.local/t09-visual-fixture.json', 'utf8'));
assert(f.email.endsWith('@example.test') && f.pupilEmail.endsWith('@example.test'));
const baseURL = 'http://127.0.0.1:5181',
  root = `/v1/organizations/${f.orgId}/agenda`;
const worker = new pg.Pool({ connectionString: process.env.WORKER_DATABASE_URL, max: 1 });
const started = Date.now(),
  report = {
    version: '0.11.0',
    scope: 'synthetic-local',
    browserInstances: 1,
    pdfGenerations: 0,
    checks: [],
    viewportWidths: [],
    errors: [],
  };
const finishOnly = process.env.FORMA_T11_FINISH === '1';
if (finishOnly) {
  await copyFile('docs/evidencias/t11-visual.json', 'docs/evidencias/t11-visual-inicial.json');
  report.scope = 'targeted-rules-cancel-rebook-header';
  report.reusedEvidence = 't11-visual-inicial.json';
}
let api,
  vite,
  browser,
  owner,
  pupil,
  oldPrefs,
  oldRule,
  eventId,
  blockId,
  stage = 'startup';
async function check(response) {
  assert.equal(response.status(), 200, await response.text());
  return response.json();
}
async function call(ctx, path, body, method = 'POST') {
  const { token } = await check(await ctx.request.get('/v1/security/csrf'));
  return check(
    await ctx.request.fetch(path, { method, headers: { 'x-csrf-token': token }, data: body }),
  );
}
async function get(ctx, path) {
  return check(await ctx.request.get(path));
}
try {
  api = await buildApp({
    origin: baseURL,
    cookieSecret: process.env.COOKIE_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    storageRoot: process.env.STORAGE_PATH,
    developmentMailbox: true,
  });
  await api.listen({ host: '127.0.0.1', port: 3004 });
  vite = await preview({
    configFile: 'apps/web/vite.config.ts',
    preview: {
      host: '127.0.0.1',
      port: 5181,
      strictPort: true,
      proxy: { '/v1': { target: 'http://127.0.0.1:3004', ws: true } },
    },
  });
  browser = await chromium.launch({ headless: true });
  owner = await browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } });
  pupil = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  for (const [ctx, email] of [
    [owner, f.email],
    [pupil, f.pupilEmail],
  ])
    await call(ctx, '/v1/auth/login', { email, password: f.password });
  stage = 'fixture';
  const meta = await get(owner, root),
    me = await get(owner, '/v1/auth/me');
  const professionalId = me.user.id,
    timezone = meta.timezone,
    day = dateShift(meta.today, 1);
  const instant = (hour) => {
    const candidates = zonedCandidates(`${day}T${hour}`, timezone);
    assert.equal(candidates.length, 1);
    return candidates[0];
  };
  const timing = (a, b) => ({ timezone, localStartsAt: `${day}T${a}`, localEndsAt: `${day}T${b}` });
  blockId = randomUUID();
  eventId = randomUUID();
  await call(
    owner,
    root + '/availability/' + blockId,
    {
      requestId: randomUUID(),
      revision: 0,
      professionalId,
      startsAt: instant('09:00'),
      endsAt: instant('12:00'),
      location: 'Sala principal',
      ...timing('09:00', '12:00'),
    },
    'PUT',
  );
  const title = 'Fuerza en grupo · QA T11 ' + eventId.slice(0, 6);
  await call(
    owner,
    root + '/events/' + eventId,
    {
      requestId: randomUUID(),
      revision: 0,
      document: {
        professionalId,
        availabilityId: blockId,
        kind: 'class',
        title,
        instructions: 'Trae agua y llega unos minutos antes.',
        location: 'Sala principal',
        startsAt: instant('10:00'),
        endsAt: instant('11:00'),
        capacity: 2,
        bookingLeadMinutes: 0,
        cancelLeadMinutes: 0,
        published: true,
      },
      reason: '',
      ...timing('10:00', '11:00'),
    },
    'PUT',
  );
  oldPrefs = (await get(pupil, root)).preferences;
  const { revision, ...prefs } = oldPrefs;
  await call(
    pupil,
    root + '/preferences',
    {
      requestId: randomUUID(),
      revision,
      document: {
        ...prefs,
        booking: true,
        reminder: true,
        quietStart: 0,
        quietEnd: 0,
        dailyLimit: 20,
      },
    },
    'PUT',
  );
  if (!finishOnly) {
    oldRule = (await get(owner, root + '/rules')).rules.find((r) => r.kind === 'appointment.soon');
    await call(owner, root + '/rules/' + oldRule.id, {
      requestId: randomUUID(),
      revision: oldRule.revision,
      enabled: true,
      leadMinutes: 10080,
    });
  }
  await writeFile(
    '.local/t11-visual-fixture.json',
    JSON.stringify({ eventId, blockId, day, title }),
  );
  const op = await owner.newPage(),
    pp = await pupil.newPage();
  for (const page of [op, pp]) {
    page.setDefaultTimeout(8000);
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(baseURL + '/agenda');
    await page.locator('.agenda-event-card').filter({ hasText: title }).click();
  }
  stage = 'reservation';
  await pp.getByRole('button', { name: 'Reservar mi plaza', exact: true }).click();
  await pp
    .locator('.agenda-own-booking strong')
    .filter({ hasText: 'Tu plaza está confirmada' })
    .waitFor();
  const first = (await get(pupil, root + '/events/' + eventId)).event.ownBooking.id;
  report.checks.push('pupil reserves through UI');
  if (!finishOnly) {
    await agendaTick(worker, 10);
    await agendaTick(worker, 10);
    const notices = (await get(pupil, root)).notifications.filter(
      (n) => n.category === 'reminder' && n.eventId === eventId,
    );
    assert.equal(notices.length, 1);
    report.checks.push('two worker ticks produce one reminder');
    await pp.getByRole('button', { name: 'Actualizar', exact: true }).click();
    await pp.locator('.agenda-inbox > summary').click();
    await pp.locator('.agenda-notice strong').filter({ hasText: 'Tu sesión se acerca' }).waitFor();
    await op.getByRole('button', { name: 'Actualizar', exact: true }).click();
    await op.locator('.agenda-roster-row').first().waitFor();
    report.checks.push('coach sees confirmed booking');
  }
  stage = 'reflow';
  for (const [page, widths] of finishOnly
    ? [[pp, [320]]]
    : [
        [pp, [320, 390, 768]],
        [op, [1440]],
      ])
    for (const width of widths) {
      await page.setViewportSize({ width, height: width === 1440 ? 960 : 844 });
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        fields: [
          ...document.querySelectorAll(
            '.agenda-workspace input:not([type=checkbox]), .agenda-workspace select, .agenda-workspace textarea',
          ),
        ]
          .filter((e) => e.getBoundingClientRect().width > 0)
          .every((e) => parseFloat(getComputedStyle(e).fontSize) >= 16),
        actions: [...document.querySelectorAll('.agenda-workspace .agenda-button')]
          .filter((e) => e.getBoundingClientRect().width > 0)
          .every((e) => e.getBoundingClientRect().height >= 44),
      }));
      assert(
        !metrics.overflow && metrics.fields && metrics.actions,
        JSON.stringify({ width, ...metrics }),
      );
      report.viewportWidths.push(width);
    }
  await pp.setViewportSize({ width: 390, height: 844 });
  await pp.screenshot({ path: 'docs/evidencias/t11-alumno-movil.png', fullPage: true });
  await op.screenshot({ path: 'docs/evidencias/t11-agenda-pc.png', fullPage: true });
  await op.locator('.agenda-tabs').getByRole('button', { name: 'Reglas', exact: true }).click();
  await op.locator('.agenda-rule-choice').first().waitFor();
  assert.equal(await op.locator('.agenda-rule-choice').count(), 3);
  await op.locator('.agenda-rule-choice').filter({ hasText: 'Próxima cita o clase' }).click();
  await op.getByRole('button', { name: 'Vista previa de destinatarios' }).click();
  await op.locator('.agenda-preview').waitFor();
  await op.screenshot({ path: 'docs/evidencias/t11-reglas-pc.png', fullPage: true });
  report.checks.push('rules and read-only preview visible');
  stage = 'cancel-rebook';
  await pp.getByRole('button', { name: 'Cancelar mi reserva', exact: true }).click();
  await pp
    .locator('.agenda-own-booking strong')
    .filter({ hasText: 'Tu reserva está cancelada' })
    .waitFor();
  await pp.getByRole('button', { name: 'Reservar mi plaza', exact: true }).click();
  await pp
    .locator('.agenda-own-booking strong')
    .filter({ hasText: 'Tu plaza está confirmada' })
    .waitFor();
  assert.notEqual((await get(pupil, root + '/events/' + eventId)).event.ownBooking.id, first);
  report.checks.push('cancel and reserve again create a new booking');
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.stage = stage;
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  try {
    if (oldPrefs) {
      const revision = (await get(pupil, root)).preferences.revision;
      const document = { ...oldPrefs };
      delete document.revision;
      await call(
        pupil,
        root + '/preferences',
        { requestId: randomUUID(), revision, document },
        'PUT',
      );
    }
    if (oldRule) {
      const rule = (await get(owner, root + '/rules')).rules.find((r) => r.id === oldRule.id);
      await call(owner, root + '/rules/' + rule.id, {
        requestId: randomUUID(),
        revision: rule.revision,
        enabled: oldRule.enabled,
        leadMinutes: oldRule.leadMinutes,
      });
    }
    if (eventId) {
      const event = (await get(owner, root + '/events/' + eventId)).event;
      if (!event.cancelled)
        await call(owner, root + '/events/' + eventId + '/cancel', {
          requestId: randomUUID(),
          revision: event.revision,
          reason: 'Cierre de muestra sintética T11; conservar historial.',
        });
    }
    if (blockId) {
      const block = (await get(owner, root)).availability.find((b) => b.id === blockId);
      if (block && !block.cancelled)
        await call(owner, root + '/availability/' + blockId + '/cancel', {
          requestId: randomUUID(),
          revision: block.revision,
        });
    }
    report.fixtureCleaned = true;
  } catch (error) {
    report.cleanupError = error.message;
    process.exitCode = 1;
  }
  await browser?.close();
  await api?.close();
  if (vite) await new Promise((resolve) => vite.httpServer.close(resolve));
  await worker.end();
  report.durationMs = Date.now() - started;
  await writeFile('docs/evidencias/t11-visual.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
