import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runMediaCommand } from '../apps/worker/src/media.ts';
const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: 'http://127.0.0.1:5173',
  viewport: { width: 1440, height: 1000 },
});
const http = context.request;
const password = 'Forma-demo-2026!';
const csrf = (await (await http.get('/v1/security/csrf')).json()).token;
async function call(method, path, body) {
  const response = await http.fetch(path, {
    method,
    headers: { 'x-csrf-token': csrf },
    ...(body === undefined ? {} : { data: body }),
  });
  if (!response.ok()) throw new Error(`Capture request failed: ${response.status()}`);
  return response.json();
}
try {
  await call('POST', '/v1/auth/login', { email: 'coach@forma.local', password });
  const org = (await call('GET', '/v1/organizations')).organizations.find(
    (o) => o.id === '20000000-0000-4000-8000-000000000001',
  );
  if (!org) throw new Error('The fictitious seeded studio is required.');
  const root = `/v1/organizations/${org.id}`;
  let guide = (await call('GET', root + '/exercises?origin=own&q=Guía%20de%20demostración'))
    .exercises[0];
  if (!guide) {
    await mkdir('.local/capture-t03', { recursive: true });
    const illustration = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><defs><linearGradient id="b" x2="1" y2="1"><stop stop-color="#0d1c34"/><stop offset="1" stop-color="#203c5a"/></linearGradient></defs><rect width="960" height="600" fill="url(#b)"/><circle cx="750" cy="90" r="190" fill="#19e7d0" opacity=".05"/><circle cx="130" cy="570" r="220" fill="#19e7d0" opacity=".06"/><g transform="translate(480 295) rotate(-20)" fill="none" stroke="#19e7d0" stroke-width="15" stroke-linejoin="round"><path d="M-150 0H150"/><rect x="-235" y="-90" width="65" height="180" rx="16"/><rect x="-170" y="-130" width="65" height="260" rx="16"/><rect x="105" y="-130" width="65" height="260" rx="16"/><rect x="170" y="-90" width="65" height="180" rx="16"/></g><text x="55" y="68" font-family="Arial,sans-serif" font-size="20" fill="#19e7d0" letter-spacing="5">FORMA / MOVIMIENTO</text><text x="55" y="545" font-family="Arial,sans-serif" font-size="17" fill="#b6c2d9" letter-spacing="2">MATERIAL DE DEMOSTRACIÓN</text><path d="M825 490v45m-22-22h44" stroke="#19e7d0" stroke-width="3"/></svg>',
    );
    const image = await sharp(illustration).png().toBuffer();
    const imagePath = resolve('.local/capture-t03/lamina.png');
    const clipPath = resolve('.local/capture-t03/clip.mp4');
    await writeFile(imagePath, image);
    await runMediaCommand(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-loop',
        '1',
        '-i',
        imagePath,
        '-t',
        '3',
        '-vf',
        'format=yuv420p',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-threads',
        '2',
        '-movflags',
        '+faststart',
        clipPath,
      ],
      15000,
    );
    async function upload(kind, bytes) {
      const reserved = await call('POST', root + '/media/uploads', {
        kind,
        bytes: bytes.length,
        requestId: randomUUID(),
      });
      const id = reserved.media.id;
      const response = await http.put(`${root}/media/${id}/content`, {
        headers: { 'x-csrf-token': csrf, 'content-type': 'application/octet-stream' },
        data: bytes,
      });
      if (response.status() !== 202) throw new Error('Capture upload failed');
      const start = Date.now();
      while (Date.now() - start < 60000) {
        const { media } = await call('GET', `${root}/media/${id}`);
        if (media.state === 'ready') return media;
        if (media.state === 'failed') throw new Error(`Capture processing: ${media.errorCode}`);
        await new Promise((done) => setTimeout(done, 500));
      }
      throw new Error('Media worker did not complete capture fixture');
    }
    const photo = await upload('image', image),
      video = await upload('video', await readFile(clipPath));
    const equipment = (
      await call('POST', root + '/equipment', {
        name: 'Mancuernas del estudio',
        description:
          'Material ficticio para explorar la biblioteca. Sustituye esta lámina por tu foto.',
        location: 'Sala de fuerza · Zona 1',
        state: 'available',
        photoId: photo.id,
      })
    ).equipment;
    guide = (
      await call('POST', root + '/exercises', {
        name: 'Guía de demostración con clip',
        instructions:
          'Este clip permite comprobar la reproducción privada y el aspecto de una guía. Sustitúyelo por una demostración propia antes de prescribir un ejercicio. Aquí puedes explicar la preparación, la ejecución y los puntos que quieres que tu alumno recuerde.',
        muscle: 'General',
        equipmentTag: 'Mancuernas',
        metric: 'reps',
        variations: ['Añade aquí tus variantes'],
        tags: ['Demo', 'Técnica'],
        state: 'published',
        equipmentId: equipment.id,
        mediaId: video.id,
      })
    ).exercise;
    await call('POST', root + '/exercises', {
      name: 'Tu primera guía de movimiento',
      instructions:
        'Una guía clara empieza con instrucciones fáciles de seguir. Este ejemplo es ficticio: edítalo, añade tus propios pasos y revisa el contenido antes de compartirlo con un alumno.',
      muscle: 'General',
      equipmentTag: 'Material del estudio',
      metric: 'time',
      variations: [],
      tags: ['Demo'],
      state: 'draft',
      equipmentId: equipment.id,
      mediaId: photo.id,
    });
  }
  const page = await context.newPage();
  await mkdir('docs/evidencias', { recursive: true });
  await page.goto('/ejercicios');
  await page.getByRole('heading', { name: 'Tu biblioteca, tu manera.' }).waitFor();
  await page.screenshot({ path: 'docs/evidencias/t03-biblioteca-pc.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Origen del ejercicio').selectOption('own');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/evidencias/t03-biblioteca-movil.png', fullPage: true });
  await page.getByRole('button', { name: 'Equipos', exact: true }).click();
  await page.screenshot({ path: 'docs/evidencias/t03-equipos-movil.png', fullPage: true });
  await page.getByRole('button', { name: 'Medios', exact: true }).click();
  await page.screenshot({ path: 'docs/evidencias/t03-medios-movil.png', fullPage: true });
  const pupilEmail = 'alumno.biblioteca@forma.local';
  let student = (await call('GET', root + '/students')).students.find(
    (s) => s.email === pupilEmail,
  );
  if (!student)
    student = (
      await call('POST', root + '/students', {
        displayName: 'Alumno de demostración',
        email: pupilEmail,
        goal: 'Conocer mi espacio de entrenamiento',
      })
    ).student;
  const studentContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 390, height: 844 },
  });
  const pupilRequest = studentContext.request;
  const pupilCsrf = (await (await pupilRequest.get('/v1/security/csrf')).json()).token;
  if (student.status === 'invited') {
    const invitation = await call('POST', `${root}/students/${student.id}/invitation`);
    const accepted = await pupilRequest.post('/v1/invitations/accept', {
      headers: { 'x-csrf-token': pupilCsrf },
      data: {
        token: new URL(invitation.url).searchParams.get('token'),
        fullName: 'Alumno de demostración',
        goal: 'Conocer mi espacio de entrenamiento',
        password,
        privacyAccepted: true,
      },
    });
    if (!accepted.ok()) throw new Error('Capture student acceptance failed');
  } else {
    const login = await pupilRequest.post('/v1/auth/login', {
      headers: { 'x-csrf-token': pupilCsrf },
      data: { email: pupilEmail, password },
    });
    if (!login.ok()) throw new Error('Capture student login failed');
  }
  await call('POST', `${root}/exercises/${guide.id}/students`, { studentId: student.id });
  const pupil = await studentContext.newPage();
  await pupil.goto('/biblioteca');
  await pupil.getByRole('searchbox', { name: 'Buscar en biblioteca' }).fill('Guía de demostración');
  await pupil.waitForTimeout(500);
  await pupil.screenshot({ path: 'docs/evidencias/t03-alumno-movil.png', fullPage: true });
  await pupil.getByRole('button', { name: `Abrir guía ${guide.name}`, exact: true }).click();
  await pupil.locator('dialog video').waitFor();
  await pupil.screenshot({ path: 'docs/evidencias/t03-guia-movil.png', fullPage: false });
  await studentContext.close();
  console.info('Seis capturas T03 generadas con material y cuentas ficticias del estudio local.');
} finally {
  await browser.close();
}
