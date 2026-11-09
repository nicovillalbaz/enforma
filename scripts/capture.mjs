/* global document */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('docs/evidencias', { recursive: true });
const browser = await chromium.launch();
try {
  for (const [name, width, height, path] of [
    ['coach-pc', 1440, 1080, '/'],
    ['coach-movil', 390, 844, '/'],
    ['alumno-movil', 390, 844, '/alumno'],
    ['sesion-movil', 390, 844, '/alumno/entrenar'],
  ]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(`http://127.0.0.1:5173${path}`);
    await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    await page.screenshot({ path: `docs/evidencias/t01-${name}.png`, fullPage: true });
    await page.close();
  }
} finally {
  await browser.close();
}
