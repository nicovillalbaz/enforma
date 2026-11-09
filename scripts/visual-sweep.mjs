import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const base = process.env.FORMA_VISUAL_URL ?? 'http://127.0.0.1:5173';
const output = join('docs', 'evidencias', 'visual-2026-11-09');
const executablePath = process.env.CHROME_PATH;
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : { channel: 'chrome' }),
});
const routes = {
  public: ['/acceso', '/registro', '/privacidad', '/condiciones', '/informacion', '/verificar'],
  demo: [
    '/',
    '/alumnos',
    '/rutinas',
    '/ejercicios',
    '/marca',
    '/sistema',
    '/alumno',
    '/alumno/entrenar',
    '/mi-perfil',
    '/alimentacion',
    '/progreso',
    '/historial',
  ],
};
const captures = new Set([
  'public:/acceso:390',
  'public:/registro:390',
  'demo:/:390',
  'demo:/alumnos:390',
  'demo:/rutinas:390',
  'demo:/ejercicios:390',
  'demo:/alumno:390',
  'demo:/mi-perfil:390',
]);
const results = [];

await mkdir(output, { recursive: true });
for (const width of [320, 390]) {
  for (const [mode, paths] of Object.entries(routes)) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    if (mode === 'demo') {
      await context.addInitScript(() => globalThis.sessionStorage.setItem('forma.demo.mode', 'on'));
    }
    const page = await context.newPage();
    for (const path of paths) {
      const issues = [];
      const onPageError = (error) => issues.push(error.message);
      page.on('pageerror', onPageError);
      try {
        await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(300);
        const state = await page.evaluate(() => ({
          heading: globalThis.document.querySelector('h1')?.textContent?.trim() ?? '',
          width: globalThis.document.documentElement.scrollWidth,
          viewport: globalThis.innerWidth,
          cards: globalThis.document.querySelectorAll('.ui-card').length,
          buttons: globalThis.document.querySelectorAll('button').length,
          paragraphs: globalThis.document.querySelectorAll('p').length,
          topText: globalThis.document.body.innerText.slice(0, 350).replace(/\s+/g, ' ').trim(),
        }));
        results.push({
          mode,
          path,
          viewWidth: width,
          finalPath: new URL(page.url()).pathname,
          ...state,
          issues,
        });
        if (captures.has(`${mode}:${path}:${width}`)) {
          const name = `${mode}-${path.replaceAll('/', '_') || 'home'}-${width}.png`;
          await page.screenshot({ path: join(output, name), fullPage: true });
        }
      } catch (error) {
        results.push({ mode, path, viewWidth: width, error: String(error), issues });
      }
      page.off('pageerror', onPageError);
    }
    await context.close();
  }
}
await browser.close();
await writeFile(join(output, 'resultados.json'), JSON.stringify(results, null, 2));
for (const row of results) {
  console.log(
    [
      row.mode,
      row.viewWidth,
      row.path,
      row.finalPath ?? 'ERROR',
      row.heading ?? '',
      row.width && row.viewport ? row.width - row.viewport : '',
      `cards=${row.cards ?? '-'}`,
      `issues=${row.issues?.length ?? 0}`,
    ].join('\t'),
  );
}
