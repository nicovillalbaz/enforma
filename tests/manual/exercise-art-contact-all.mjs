/* One contact sheet to visually inspect the complete illustrated base catalogue. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { exerciseArtworkSlugs } from '../../apps/web/src/exercise-artwork.ts';
import { exerciseFramePairs } from '../../apps/web/src/exercise-frame-pairs.ts';

const cards = await Promise.all(
  exerciseArtworkSlugs.map(async (slug) => {
    const frame = exerciseFramePairs[slug]?.[1] ?? 2;
    const svg = await readFile(resolve(`apps/web/public/exercise-art/${slug}/frame-${frame}.svg`));
    return `<article><img src="data:image/svg+xml;base64,${svg.toString('base64')}" alt=""><span>${slug}</span></article>`;
  }),
);
const html = `<html><head><style>body{margin:0;padding:18px;background:#eef3f7;color:#14263d;font:11px Arial}main{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}article{height:185px;background:#fff;border:1px solid #dce5ed;border-radius:10px;overflow:hidden;display:grid;grid-template-rows:1fr 26px}img{width:100%;height:155px;object-fit:contain;background:#f8fafc}span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 8px}</style></head><body><main>${cards.join('')}</main></body></html>`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1120, height: 800 } });
  await page.setContent(html);
  await page.screenshot({ path: 'docs/evidencias/exercise-art-contact-all.png', fullPage: true });
} finally {
  await browser.close();
}
console.info(`Rendered ${cards.length} illustrations.`);
