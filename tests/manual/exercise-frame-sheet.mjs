/* Contact sheet to compare all three poses within representative exercises. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const exercises = [
  ['bench-press', 'Press de banca'],
  ['dumbbell-bench-press', 'Press mancuernas'],
  ['machine-chest-press', 'Press máquina'],
  ['goblet-squat', 'Sentadilla goblet'],
  ['lat-pulldown', 'Jalón al pecho'],
  ['leg-press', 'Prensa'],
];
const artRoot = process.env.FORMA_ART_ROOT ?? 'apps/web/public/exercise-art';
const outputPath =
  process.env.FORMA_FRAME_SHEET_OUTPUT ?? 'docs/evidencias/exercise-frame-sheet.png';
const rows = await Promise.all(
  exercises.map(async ([slug, label]) => {
    const frames = await Promise.all(
      [1, 2, 3].map(async (n) => {
        const bytes = await readFile(resolve(`${artRoot}/${slug}/frame-${n}.svg`));
        return `<div><img src="data:image/svg+xml;base64,${bytes.toString('base64')}" alt=""><small>${n}</small></div>`;
      }),
    );
    return `<article><strong>${label}</strong>${frames.join('')}</article>`;
  }),
);
const html = `<html><head><style>body{font:14px Arial;color:#14263d;background:#eef3f7;padding:20px;margin:0}main{display:grid;gap:8px}article{display:grid;grid-template-columns:170px repeat(3,1fr);align-items:center;background:#fff;border:1px solid #dce5ed;border-radius:12px;height:166px}strong{padding:12px}article div{height:150px;position:relative;overflow:hidden;background:#f8fafc}img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}small{position:absolute;bottom:3px;right:6px;color:#557}</style></head><body><main>${rows.join('')}</main></body></html>`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1100 } });
  await page.setContent(html);
  await page.screenshot({ path: outputPath, fullPage: true });
} finally {
  await browser.close();
}
console.info('Rendered 18 poses.');
