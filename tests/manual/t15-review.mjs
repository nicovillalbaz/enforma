/* global document, innerWidth, getComputedStyle */
// One bounded UI review against the existing synthetic demo. No data reset or business writes.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { demoConfig, demoOrigin } from '../../scripts/manual-demo-config.mjs';

const report = {
  date: '2026-10-24',
  scope: 'existing-synthetic-demo-ui',
  browserInstances: 1,
  pageErrors: [],
  checks: [],
  screenshots: [],
  businessWrites: 0,
};
let browser,
  stage = 'launch';
const started = Date.now();
const timer = setTimeout(() => {
  report.budgetExceeded = true;
  void browser?.close();
}, 60000);
async function layout(page, label) {
  const result = await page.evaluate(() => ({
    width: innerWidth,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    dialogs: document.querySelectorAll('dialog').length,
    inputFonts: [...document.querySelectorAll('input:not([type=checkbox])')]
      .filter((e) => e.getBoundingClientRect().width > 0)
      .map((e) => Number.parseFloat(getComputedStyle(e).fontSize)),
  }));
  assert(
    !result.overflow && !result.dialogs && result.inputFonts.every((n) => n >= 16),
    JSON.stringify(result),
  );
  report.checks.push({ label, ...result });
}
try {
  const config = await demoConfig();
  browser = await chromium.launch({ headless: true, timeout: 8000 });
  const context = await browser.newContext({
    baseURL: demoOrigin,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  });
  const resume = process.argv.includes('--resume-login');
  if (resume)
    await context.addInitScript(() => {
      sessionStorage.setItem('forma.install.continued', '1');
    });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  page.on('dialog', (dialog) => {
    report.pageErrors.push('Unexpected native dialog: ' + dialog.type());
    void dialog.dismiss();
  });
  stage = 'installation-first';
  await page.goto('/acceso');
  if (!resume) {
    await page.locator('.install-welcome').waitFor();
    await page.getByRole('button', { name: 'Continuar en el navegador' }).click();
    report.checks.push({ label: stage, result: 'passed; native installation not attempted' });
  } else report.checks.push({ label: stage, result: 'reused from initial report; not repeated' });
  stage = 'coach-login';
  await page.getByLabel('Correo electrónico', { exact: true }).fill('coach.aurora@example.test');
  await page.getByLabel('Contraseña', { exact: true }).fill(config.password);
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await page.waitForURL(demoOrigin + '/');
  stage = 'mobile-student-page';
  await page.goto('/alumnos/nuevo');
  await page.getByRole('heading', { name: 'Nuevo alumno', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Objetivo (opcional)', { exact: true }).inputValue(), '');
  await layout(page, 'new-student-390');
  await page.screenshot({ path: 'docs/evidencias/t15-mobile.png' });
  report.screenshots.push('t15-mobile.png');
  await page.setViewportSize({ width: 320, height: 740 });
  await layout(page, 'new-student-320');
  stage = 'cancel-discard-keeps-draft';
  await page.getByLabel('Nombre completo', { exact: true }).fill('Ficha sin guardar T15');
  await page.locator('.flow-back').click();
  await page.getByRole('heading', { name: 'Revisar acción' }).waitFor();
  await page.locator('.flow-actions').getByRole('button', { name: 'Volver', exact: true }).click();
  assert.equal(
    await page.getByLabel('Nombre completo', { exact: true }).inputValue(),
    'Ficha sin guardar T15',
  );
  await page.locator('.flow-back').click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await page.waitForURL('**/alumnos');
  report.checks.push({
    label: stage,
    result: 'passed; explicit confirm then left without creating a pupil',
  });
  stage = 'desktop-routine';
  await page.setViewportSize({ width: 1366, height: 638 });
  await page.goto('/rutinas?edit=new');
  await page.getByRole('heading', { name: 'Nueva rutina', exact: true }).waitFor();
  await page.getByLabel('Nombre del programa', { exact: true }).fill('Borrador visual T15');
  await layout(page, 'routine-1366');
  const structure = await page.locator('.program-editor').evaluate((e) => ({
    visibleStages: [...e.querySelectorAll('.builder-stage')].filter(
      (x) => getComputedStyle(x).display !== 'none',
    ).length,
    internalScrolls: [...e.querySelectorAll('.builder-stage')].filter((x) =>
      ['auto', 'scroll'].includes(getComputedStyle(x).overflowY),
    ).length,
    actionsPosition: getComputedStyle(e.querySelector('.program-editor-actions')).position,
  }));
  assert.equal(structure.visibleStages, 1);
  assert.equal(structure.internalScrolls, 0);
  assert.equal(structure.actionsPosition, 'static');
  report.checks.push({ label: stage, ...structure });
  await page.screenshot({ path: 'docs/evidencias/t15-desktop.png' });
  report.screenshots.push('t15-desktop.png');
  stage = 'create-exercise-in-routine';
  await page.getByRole('button', { name: '2. Ejercicios', exact: true }).click();
  await page.getByRole('button', { name: 'Añadir ejercicio', exact: true }).click();
  await page.getByRole('button', { name: 'Crear ejercicio y añadirlo', exact: true }).click();
  await page.getByRole('heading', { name: 'Nuevo ejercicio', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Grupo o categoría', { exact: true }).inputValue(), '');
  assert.equal(await page.getByLabel('Tipo de registro', { exact: true }).inputValue(), '');
  await page.locator('.flow-back').click();
  await page.getByRole('heading', { name: 'Nueva rutina', exact: true }).waitFor();
  await page.getByRole('button', { name: '1. Estructura', exact: true }).click();
  assert.equal(
    await page.getByLabel('Nombre del programa', { exact: true }).inputValue(),
    'Borrador visual T15',
  );
  report.checks.push({
    label: stage,
    result: 'passed; empty exercise form and routine draft retained; no exercise saved',
  });
  assert.deepEqual(report.pageErrors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failedStage = stage;
  report.error = error.message;
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  await browser?.close();
  report.durationMs = Date.now() - started;
  await writeFile('docs/evidencias/t15-ui-review.json', JSON.stringify(report, null, 2) + '\n');
  console.info(JSON.stringify(report));
}
