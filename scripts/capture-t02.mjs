import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: 'http://127.0.0.1:5173',
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
await mkdir('docs/evidencias', { recursive: true });
try {
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('coach@forma.local');
  await page.getByLabel('Contraseña', { exact: true }).fill('Forma-demo-2026!');
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await page.waitForURL('http://127.0.0.1:5173/');
  await page.getByRole('heading', { name: 'Tu comunidad empieza aquí.' }).waitFor();
  await page.screenshot({ path: 'docs/evidencias/t02-coach-pc.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/evidencias/t02-coach-movil.png', fullPage: true });
  await page.goto('/marca');
  await page.getByRole('heading', { name: 'Se siente como tú.' }).waitFor();
  await page.screenshot({ path: 'docs/evidencias/t02-marca-movil.png', fullPage: true });
  await page.goto('/alumno');
  await page.getByRole('heading', { name: 'Así será la bienvenida de tus alumnos.' }).waitFor();
  await page.screenshot({ path: 'docs/evidencias/t02-alumno-movil.png', fullPage: true });
  const publicContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 390, height: 844 },
  });
  const registration = await publicContext.newPage();
  await registration.goto('/registro');
  await registration.getByRole('heading', { name: 'Empecemos por ti.' }).waitFor();
  await registration.screenshot({ path: 'docs/evidencias/t02-registro-movil.png', fullPage: true });
  await publicContext.close();
  console.info('Cinco capturas T02 creadas con la cuenta ficticia de desarrollo.');
} finally {
  await browser.close();
}
