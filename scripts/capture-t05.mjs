/* global window:readonly, document:readonly */
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const browser = await chromium.launch(),
  baseURL = 'http://127.0.0.1:5173',
  password = 'Forma-demo-2026!';
try {
  const coach = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } }),
    student = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  async function call(context, method, path, body) {
    const token = (await (await context.request.get('/v1/security/csrf')).json()).token;
    const r = await context.request.fetch(path, {
      method,
      headers: { 'x-csrf-token': token },
      ...(body === undefined ? {} : { data: body }),
    });
    if (!r.ok()) throw new Error(`T05 capture failed: ${r.status()} ${path}`);
    return r.json();
  }
  await call(coach, 'POST', '/v1/auth/login', { email: 'coach@forma.local', password });
  const org = (await call(coach, 'GET', '/v1/organizations')).organizations.find(
    (o) => o.id === '20000000-0000-4000-8000-000000000001',
  );
  if (!org) throw new Error('Only the seeded fictitious studio is allowed.');
  const root = `/v1/organizations/${org.id}`;
  await call(student, 'POST', '/v1/auth/login', { email: 'alumno.rutina@forma.local', password });
  const assignments = (await call(student, 'GET', root + '/program-assignments?state=active'))
      .assignments,
    assignment = assignments.find((a) => a.programName === 'Programa de demostración · 8 semanas');
  if (!assignment) throw new Error('Run the T04 fictitious capture setup first.');
  const version = (await call(student, 'GET', root + `/program-versions/${assignment.versionId}`))
      .version,
    w = version.snapshot.weeks[0],
    d = w.days[0];
  const page = await student.newPage();
  await page.goto(`/entrenar?assignmentId=${assignment.id}&weekId=${w.id}&dayId=${d.id}`);
  await page.locator('.workout-outline').waitFor();
  const start = page.getByRole('button', { name: 'Iniciar sesión', exact: true });
  if (await start.isVisible()) await start.click();
  else if (
    await page
      .getByRole('button', { name: 'Corregir registro con motivo', exact: true })
      .isVisible()
  ) {
    page.once('dialog', (dialog) => dialog.accept('Renovar capturas de demostración ficticia'));
    await page.getByRole('button', { name: 'Corregir registro con motivo', exact: true }).click();
  }
  await page.getByText('Todos los cambios confirmados por el servidor').waitFor();
  await mkdir('docs/evidencias', { recursive: true });
  await page
    .getByRole('navigation', { name: 'Series del entrenamiento' })
    .getByRole('button')
    .first()
    .click();
  await page.locator('.workout-current').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -18));
  await page.screenshot({ path: 'docs/evidencias/t05-entrenar-movil.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/evidencias/t05-entrenar-pc.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await student.setOffline(true);
  await page.getByLabel('Carga (kg, opcional)', { exact: true }).fill('42.5');
  await page.getByLabel('Repeticiones', { exact: true }).fill('9');
  const save = page.getByRole('button', { name: /^(Guardar|Actualizar) serie$/ });
  await save.click();
  await page.getByText('1 cambio(s) guardados en este dispositivo', { exact: false }).waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/evidencias/t05-pendiente-movil.png' });
  await student.setOffline(false);
  await page.getByText('Todos los cambios confirmados por el servidor').waitFor();
  await page
    .getByLabel('Notas de la sesión', { exact: true })
    .fill('Sesión ficticia de demostración: registro parcial y valores de ejemplo.');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Finalizar sesión', exact: false }).click();
  await page.getByText('Todos los cambios confirmados por el servidor').waitFor();
  await page.goto('/historial');
  await page.getByText('Ver objetivos y valores realizados').first().click();
  await page.evaluate(() => document.activeElement?.blur());
  await page
    .locator('.workout-history-card')
    .first()
    .evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.evaluate(() => window.scrollBy(0, -18));
  await page.screenshot({ path: 'docs/evidencias/t05-historial-movil.png', fullPage: false });
  const p = await coach.newPage();
  await p.goto(`/historial?studentId=${assignment.studentId}`);
  await p.getByText('Ver objetivos y valores realizados').first().click();
  await p.screenshot({ path: 'docs/evidencias/t05-resumen-coach-pc.png', fullPage: true });
  console.log(
    'Cinco capturas T05: entrenamiento móvil/PC, pendiente local e historial alumno/coach. Solo seed ficticio.',
  );
} finally {
  await browser.close();
}
