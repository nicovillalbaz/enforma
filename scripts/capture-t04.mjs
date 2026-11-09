/* global window:readonly */
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { freshSet, cloneWeek } from '../packages/shared/src/programs.ts';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:5173',
      viewport: { width: 1440, height: 1000 },
    }),
    http = context.request,
    password = 'Forma-demo-2026!';
  const csrf = (await (await http.get('/v1/security/csrf')).json()).token;
  async function call(method, path, body) {
    const response = await http.fetch(path, {
      method,
      headers: { 'x-csrf-token': csrf },
      ...(body === undefined ? {} : { data: body }),
    });
    if (!response.ok()) throw new Error(`T04 capture request failed: ${response.status()} ${path}`);
    return response.json();
  }
  await call('POST', '/v1/auth/login', { email: 'coach@forma.local', password });
  const org = (await call('GET', '/v1/organizations')).organizations.find(
    (o) => o.id === '20000000-0000-4000-8000-000000000001',
  );
  if (!org) throw new Error('Only the fictitious seeded studio is allowed.');
  const root = `/v1/organizations/${org.id}`;
  const exercises = (await call('GET', root + '/exercises?limit=100')).exercises;
  const guide = exercises.find(
    (e) => e.name === 'Guía de demostración con clip' && e.media?.state === 'ready',
  );
  if (!guide) throw new Error('Generate the T03 fictitious demonstration first.');
  const programName = 'Programa de demostración · 8 semanas';
  let program = (
    await call('GET', root + '/programs?q=' + encodeURIComponent(programName))
  ).programs.find((p) => p.document.name === programName);
  if (!program) {
    const week = {
      id: randomUUID(),
      name: 'Base y técnica',
      days: [
        {
          id: randomUUID(),
          name: 'Fuerza con intención',
          weekday: 1,
          notes: 'Prioriza el control y sigue las indicaciones de tu coach.',
          exercises: [
            {
              id: randomUUID(),
              exerciseId: '61000000-0000-4000-8000-000000000001',
              notes: 'Demostración técnica ficticia. Ajustar con un profesional.',
              sets: [freshSet(), freshSet(), freshSet()],
            },
            {
              id: randomUUID(),
              exerciseId: guide.id,
              notes: 'El clip muestra una ilustración de demostración, no una ejecución física.',
              sets: [
                { ...freshSet(), weightKg: 20 },
                { ...freshSet(), weightKg: 20 },
                { ...freshSet(), weightKg: 20 },
              ],
            },
          ],
        },
        {
          id: randomUUID(),
          name: 'Control y estabilidad',
          weekday: 4,
          notes: 'Respira y adapta cada apoyo a tus necesidades.',
          exercises: [
            {
              id: randomUUID(),
              exerciseId: '61000000-0000-4000-8000-000000000003',
              notes: 'Tu coach indicará la variante adecuada.',
              sets: [freshSet('time'), freshSet('time')],
            },
          ],
        },
      ],
    };
    const doc = {
      name: programName,
      description:
        'Ocho semanas de ejemplo para conocer el constructor, los objetivos y la experiencia del alumno. Contenido ficticio, pendiente de adaptación profesional.',
      isTemplate: true,
      weeks: [
        week,
        ...Array.from({ length: 7 }, (_, i) => ({
          ...cloneWeek(week),
          name:
            i < 3 ? 'Base y técnica' : i < 6 ? 'Progresar con control' : 'Consolidar lo aprendido',
        })),
      ],
    };
    program = (await call('POST', root + '/programs', { document: doc })).program;
  }
  const versions = (await call('GET', root + `/programs/${program.id}/versions`)).versions;
  let version = versions.at(-1);
  if (!version)
    version = (
      await call('POST', root + `/programs/${program.id}/publish`, { revision: program.revision })
    ).version;
  const studentContexts = [];
  const students = [];
  for (const [email, name] of [
    ['alumno.biblioteca@forma.local', 'Alumno de demostración'],
    ['alumno.rutina@forma.local', 'Alumna de rutina'],
  ]) {
    let student = (await call('GET', root + '/students?limit=100')).students.find(
      (s) => s.email === email,
    );
    if (!student)
      student = (
        await call('POST', root + '/students', {
          displayName: name,
          email,
          goal: 'Conocer mi programa de entrenamiento',
        })
      ).student;
    const pupilContext = await browser.newContext({
      baseURL: 'http://127.0.0.1:5173',
      viewport: { width: 390, height: 844 },
    });
    studentContexts.push(pupilContext);
    const studentCsrf = (await (await pupilContext.request.get('/v1/security/csrf')).json()).token;
    if (student.status === 'invited') {
      const invitation = await call('POST', root + `/students/${student.id}/invitation`);
      const accepted = await pupilContext.request.post('/v1/invitations/accept', {
        headers: { 'x-csrf-token': studentCsrf },
        data: {
          token: new URL(invitation.url).searchParams.get('token'),
          fullName: name,
          goal: 'Conocer mi programa de entrenamiento',
          password,
          privacyAccepted: true,
        },
      });
      if (!accepted.ok()) throw new Error('T04 fictitious acceptance failed');
    } else {
      const login = await pupilContext.request.post('/v1/auth/login', {
        headers: { 'x-csrf-token': studentCsrf },
        data: { email, password },
      });
      if (!login.ok()) throw new Error('T04 fictitious login failed');
    }
    students.push(student);
  }
  const existing = (await call('GET', root + '/program-assignments?state=active&limit=100'))
    .assignments;
  const pending = students.filter(
    (s) => !existing.some((a) => a.studentId === s.id && a.versionId === version.id),
  );
  if (pending.length) {
    const startsOn = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    await call('POST', root + `/program-versions/${version.id}/assignments`, {
      startsOn,
      studentIds: pending.map((s) => s.id),
      requestId: randomUUID(),
    });
  }
  await mkdir('docs/evidencias', { recursive: true });
  const page = await context.newPage();
  await page.goto('/rutinas');
  await page.getByRole('searchbox', { name: 'Buscar programa' }).fill(programName);
  const card = page
    .locator('.program-card')
    .filter({ has: page.getByRole('heading', { name: programName, exact: true }) });
  await card.waitFor();
  await page.screenshot({ path: 'docs/evidencias/t04-programas-pc.png', fullPage: true });
  await card.getByRole('button', { name: 'Editar programa', exact: true }).click();
  await page.getByRole('button', { name: 'Editar semana 3', exact: true }).click();
  await page.getByRole('button', { name: 'Editar ejercicio 2', exact: true }).click();
  await page.getByText('Guía de demostración con clip', { exact: true }).first().waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => window.scrollY === 0);
  await page.screenshot({ path: 'docs/evidencias/t04-constructor-pc.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '2. Ejercicios', exact: true }).click();
  await page.locator('.program-day-editor').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/evidencias/t04-constructor-movil.png', fullPage: false });
  await page.locator('.program-set-editor').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/evidencias/t04-series-movil.png', fullPage: false });
  await page.getByRole('button', { name: 'Volver a programas', exact: true }).click();
  await card.getByRole('button', { name: 'Versiones y asignar', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.screenshot({ path: 'docs/evidencias/t04-asignar-movil.png', fullPage: false });
  const pupil = await studentContexts[0].newPage();
  await pupil.goto('/mi-programa');
  await pupil.getByRole('button', { name: 'Consultar programa', exact: true }).click();
  await pupil.getByLabel('Semana del programa').selectOption('2');
  await pupil
    .locator('.program-prescription')
    .first()
    .evaluate((element) => element.scrollIntoView({ block: 'start' }));
  await pupil.evaluate(() => window.scrollBy(0, -16));
  await pupil.screenshot({ path: 'docs/evidencias/t04-alumno-movil.png', fullPage: false });
  await pupil.setViewportSize({ width: 1440, height: 1000 });
  await pupil.evaluate(() => window.scrollTo(0, 0));
  await pupil.waitForFunction(() => window.scrollY === 0);
  await pupil.screenshot({ path: 'docs/evidencias/t04-alumno-pc.png', fullPage: true });
  console.info('Siete capturas T04 guardadas con programa y dos alumnos ficticios del seed.');
} finally {
  await browser.close();
}
