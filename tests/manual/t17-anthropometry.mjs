import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { demoConfig, demoOrigin } from '../../scripts/manual-demo-config.mjs';

const report = { date: '2026-10-26', checks: [], screenshots: [], errors: [] };
const config = await demoConfig();
const browser = await chromium.launch({ headless: true, timeout: 15000 });
let stage = 'init';
async function login(email) {
  const context = await browser.newContext({
    baseURL: demoOrigin,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  });
  await context.addInitScript(() => sessionStorage.setItem('forma.install.continued', '1'));
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (error) => report.errors.push(error.message));
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(config.password);
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  try {
    await page.waitForURL((url) => url.pathname !== '/acceso', { timeout: 10000 });
  } catch {
    throw new Error(
      `Login remained at ${page.url()}; alerts: ${(await page.locator('[role=alert]').allTextContents()).join(' | ')}`,
    );
  }
  const csrfResponse = await context.request.get('/v1/security/csrf');
  assert.equal(csrfResponse.status(), 200);
  const csrf = (await csrfResponse.json()).token;
  return { context, page, csrf };
}
async function json(context, method, path, data, csrf) {
  const response = await context.request.fetch(demoOrigin + path, {
    method,
    ...(data ? { data, headers: { 'X-CSRF-Token': csrf } } : {}),
  });
  return { status: response.status(), data: await response.json() };
}
function layout(page) {
  return page.evaluate(() => ({
    width: innerWidth,
    screen: screen.width,
    documentWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    protruding: [...document.querySelectorAll('body *')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width && r.right > screen.width + 1;
      })
      .slice(0, 12)
      .map((e) => {
        const r = e.getBoundingClientRect();
        return `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 60)}:${Math.round(r.left)}-${Math.round(r.right)}`;
      }),
    inputFonts: [...document.querySelectorAll('.anthro-workspace input')]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .map((e) => Number.parseFloat(getComputedStyle(e).fontSize)),
  }));
}
let coach, student, other;
try {
  stage = 'coach-login';
  coach = await login('coach.aurora@example.test');
  const orgs = await json(coach.context, 'GET', '/v1/organizations');
  assert.equal(orgs.status, 200);
  const org = orgs.data.organizations.find((item) => item.role === 'owner');
  assert(org);
  const pupils = await json(coach.context, 'GET', `/v1/organizations/${org.id}/students`);
  assert.equal(pupils.status, 200);
  const luna = pupils.data.students.find(
    (item) => item.email === 'alumno.luna@example.test' || /luna/i.test(item.displayName),
  );
  assert(luna);
  const root = `/v1/organizations/${org.id}/anthropometry/${luna.id}`;
  stage = 'draft';
  const input = {
    protocol: 'isak-restricted',
    assessedOn: '2026-10-24',
    instrument: 'Calibre ficticio T17',
    notes: 'Datos ficticios T17 para revisar captura, cálculo y permisos.',
    equationPopulation: 'male',
    ageYears: 25,
    externalBodyFatPercent: null,
    externalDevice: '',
    externalAlgorithm: '',
    observations: ['biceps', 'triceps', 'subscapular', 'iliac_crest'].map((site) => ({
      site,
      label: site,
      unit: 'mm',
      readings: [10, 10],
    })),
  };
  const existing = await json(coach.context, 'GET', `${root}?from=2026-10-20&to=2026-10-26`);
  assert.equal(existing.status, 200);
  let assessment =
    existing.data.assessments.find((a) => a.notes === input.notes && a.status === 'final') ??
    existing.data.assessments.find((a) => a.notes === input.notes && a.status === 'draft');
  if (!assessment) {
    const made = await json(
      coach.context,
      'POST',
      root,
      { requestId: crypto.randomUUID(), input },
      coach.csrf,
    );
    assert.equal(made.status, 200, JSON.stringify(made.data));
    assessment = made.data.assessment;
    assert.equal(assessment.status, 'draft');
    report.checks.push('coach draft created');
  }
  stage = 'student-draft-visibility';
  student = await login('alumno.luna@example.test');
  const before = await json(student.context, 'GET', `${root}?from=2026-10-20&to=2026-10-26`);
  assert.equal(before.status, 200, JSON.stringify(before.data));
  if (assessment.status === 'draft') {
    assert(!before.data.assessments.some((a) => a.id === assessment.id));
    report.checks.push('student cannot read draft');
    stage = 'finalize';
    const done = await json(
      coach.context,
      'POST',
      `${root}/${assessment.id}/finalize`,
      { revision: assessment.revision },
      coach.csrf,
    );
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assessment = done.data.assessment;
  }
  assert.equal(assessment.status, 'final');
  assert.equal(assessment.result.sum4Mm, 40);
  assert.equal(assessment.result.estimate.bodyFatPercent, 16.2);
  report.checks.push('server calculation and immutable finalized result');
  stage = 'student-final-visibility';
  const after = await json(student.context, 'GET', `${root}?from=2026-10-20&to=2026-10-26`);
  assert.equal(after.status, 200, JSON.stringify(after.data));
  assert(after.data.assessments.some((a) => a.id === assessment.id));
  const studentWrite = await json(
    student.context,
    'POST',
    root,
    { requestId: crypto.randomUUID(), input },
    student.csrf,
  );
  assert.equal(studentWrite.status, 403);
  report.checks.push('student sees final and cannot write');
  stage = 'cross-organization';
  other = await login('coach.brisa@example.test');
  const denied = await json(other.context, 'GET', `${root}?from=2026-10-20&to=2026-10-26`);
  assert([403, 404].includes(denied.status), JSON.stringify(denied.data));
  report.checks.push('other coach denied');
  stage = 'export';
  const xlsx = await coach.context.request.get(`${root}/export.xlsx?from=2026-10-20&to=2026-10-26`);
  assert.equal(xlsx.status(), 200);
  assert((await xlsx.body()).length > 1000);
  report.checks.push('private XLSX downloaded');
  stage = 'responsive';
  await coach.page.goto(`/antropometria?studentId=${luna.id}&from=/alumnos/${luna.id}`);
  await coach.page.getByRole('heading', { name: 'Antropometría' }).waitFor();
  await coach.page.locator('.anthro-row').first().waitFor();
  for (const width of [320, 390, 1366]) {
    await coach.page.setViewportSize({ width, height: width === 1366 ? 768 : 740 });
    const result = await layout(coach.page);
    assert(
      !result.overflow && result.width <= width + 1 && result.inputFonts.every((n) => n >= 16),
      JSON.stringify(result),
    );
    report.checks.push({ screen: 'list', ...result });
    if (width === 390 || width === 1366) {
      const path = `docs/evidencias/t17-anthro-${width}.png`;
      await coach.page.screenshot({ path });
      report.screenshots.push(path);
    }
  }
  await coach.page
    .locator('.anthro-row')
    .filter({ hasText: 'Perfil ISAK restringido' })
    .first()
    .click();
  assert(await coach.page.getByText('16.2 %').count());
  const detailLayout = await layout(coach.page);
  assert(!detailLayout.overflow);
  report.checks.push('detail opens without horizontal overflow');
  stage = 'pdf-and-capture';
  await coach.page.evaluate(() => {
    window.print = () => {};
  });
  await coach.page.getByRole('button', { name: 'Guardar como PDF' }).click();
  await coach.page.emulateMedia({ media: 'print' });
  const pdf = await coach.page.pdf({ format: 'A4' });
  assert(pdf.length > 3000);
  report.checks.push({ pdfBytes: pdf.length, kind: 'browser print of finalized assessment' });
  await coach.page.emulateMedia({ media: 'screen' });
  await coach.page.locator('.anthro-heading button').click();
  await coach.page.getByRole('button', { name: 'Nueva evaluación' }).click();
  await coach.page.setViewportSize({ width: 390, height: 740 });
  assert.equal((await layout(coach.page)).overflow, false);
  await coach.page.getByRole('button', { name: 'Continuar' }).click();
  await coach.page.getByRole('heading', { name: 'Masa corporal' }).waitFor();
  assert.equal((await layout(coach.page)).overflow, false);
  await coach.page.getByLabel('Ir a sitio').selectOption('4');
  await coach.page.getByLabel('Lectura 1').fill('10');
  await coach.page.getByLabel('Lectura 2').fill('10');
  assert.equal((await layout(coach.page)).overflow, false);
  report.checks.push('mobile capture advances by site without horizontal overflow');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.stage = stage;
  report.error = error.message;
  if (coach?.page)
    report.page = {
      url: coach.page.url(),
      alerts: await coach.page
        .locator('[role=alert]')
        .allTextContents()
        .catch(() => []),
    };
  process.exitCode = 1;
} finally {
  await coach?.context.close();
  await student?.context.close();
  await other?.context.close();
  await browser.close();
  await writeFile('docs/evidencias/t17-anthro-review.json', JSON.stringify(report, null, 2) + '\n');
  console.info(JSON.stringify(report));
}
