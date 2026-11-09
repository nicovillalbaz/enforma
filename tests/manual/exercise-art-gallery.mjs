/* One small visual QA sheet for the selected licensed exercise art. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const samples = [
  ['bench-press', 'Press de banca · barra', 'Barra'],
  ['dumbbell-bench-press', 'Press de banca · mancuernas', 'Mancuernas'],
  ['machine-chest-press', 'Press de pecho · máquina', 'Máquina'],
  ['cable-fly', 'Aperturas · polea', 'Polea'],
  ['squat', 'Sentadilla · barra', 'Barra'],
  ['goblet-squat', 'Sentadilla goblet', 'Mancuerna'],
  ['leg-press', 'Prensa de piernas', 'Máquina'],
  ['lat-pulldown', 'Jalón al pecho', 'Polea'],
];
const cards = await Promise.all(
  samples.map(async ([slug, label, tool]) => {
    const svg = await readFile(resolve(`apps/web/public/exercise-art/${slug}/frame-2.svg`));
    return `<article><div class="picture"><img src="data:image/svg+xml;base64,${svg.toString('base64')}" alt=""></div><strong>${label}</strong><span>${tool}</span></article>`;
  }),
);
const html = `<html><head><style>
body{background:#eef3f7;color:#14263d;font:14px Arial;margin:0;padding:24px}
main{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
article{background:#fff;border:1px solid #d7e1ea;border-radius:14px;overflow:hidden;padding-bottom:12px}
.picture{height:250px;background:#f8fafc;position:relative;overflow:hidden}
img{position:absolute;inset:0;height:100%;width:100%;object-fit:contain;padding:6px;box-sizing:border-box}
strong,span{display:block;margin:8px 13px 0}span{color:#357a99;font-size:12px;margin-top:4px}
</style></head><body><main>${cards.join('')}</main></body></html>`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 780 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html);
  await page.screenshot({ path: 'docs/evidencias/exercise-art-gallery.png', fullPage: true });
} finally {
  await browser.close();
}
console.info('Rendered 8 selected exercise illustrations.');
