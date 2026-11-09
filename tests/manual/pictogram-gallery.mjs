/* Visual QA contact sheet for each family and the equipment variants in the base catalog. */
import { chromium } from 'playwright';
import { exerciseSymbols } from '../../apps/web/src/exercise-symbols.ts';
import { pictogramPose } from '../../apps/web/src/exercise-pictograms.ts';

const variants = [
  ['bench', 'Press de banca con barra'],
  ['bench', 'Press de banca con mancuernas'],
  ['bench', 'Press de pecho en máquina'],
  ['bench', 'Press inclinado con barra'],
  ['squat', 'Sentadilla con barra'],
  ['squat', 'Sentadilla goblet'],
  ['row', 'Remo con mancuerna'],
  ['row', 'Remo en máquina'],
  ['row', 'Remo en polea baja'],
  ['overhead', 'Press militar con barra'],
  ['overhead', 'Press de hombros en máquina'],
  ['fly', 'Aperturas con mancuernas'],
  ['fly', 'Aperturas en polea'],
  ['hipthrust', 'Empuje de cadera con barra'],
  ['lateralraise', 'Elevaciones laterales con mancuernas'],
  ['lateralraise', 'Elevaciones laterales en polea'],
  ['triceps', 'Extensión de tríceps en polea'],
  ['triceps', 'Extensión de tríceps con mancuerna'],
];
const examples = [...exerciseSymbols.map((symbol) => [symbol.key, symbol.label]), ...variants];
const cards = examples
  .map(([key, label]) => {
    const symbol = exerciseSymbols.find((candidate) => candidate.key === key);
    const figures = [0, 1].map((phase) => {
      const pose = pictogramPose(key, phase, symbol, label);
      return `<svg viewBox="0 0 120 96" aria-label="${label}, vista ${phase + 1}">
      <path d="${pose.floor}" class="floor"/>
      <path d="${pose.pad}" class="pad"/>
      <path d="${pose.scene}" class="scene"/>
      <path d="${pose.core}" class="core"/>
      <path d="${pose.body}" class="body"/>
      <circle cx="${pose.head?.[0] ?? 60}" cy="${pose.head?.[1] ?? 26}" r="7" class="head"/>
      <path d="${pose.tool}" class="tool"/>
    </svg>`;
    });
    return `<article><strong>${label}</strong><div>${figures.join('')}</div></article>`;
  })
  .join('');
const html = `<html><head><style>
  body{font:14px Arial;background:#f2f5f8;margin:0;padding:24px;color:#14233b}
  main{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  article{background:#fff;border:1px solid #dce4ed;border-radius:10px;padding:10px}
  article>div{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  svg{width:100%;height:105px;fill:none;stroke-linecap:round;stroke-linejoin:round}
  .floor{stroke:#c6d1db;stroke-width:2}.pad{fill:#b6dbe8;stroke:#21688c;stroke-width:2}
  .scene{stroke:#3980a2;stroke-width:3.5}
  .body{stroke:#14263d;stroke-width:7}.core{stroke:#14263d;stroke-width:11}.head{fill:#14263d;stroke:#fff;stroke-width:1.5}
  .tool{stroke:#cf6035;stroke-width:4.5}
  strong{display:block;margin-bottom:5px}
  </style></head><body><main>${cards}</main></body></html>`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html);
  await page.screenshot({ path: 'docs/evidencias/pictogram-gallery.png', fullPage: true });
} finally {
  await browser.close();
}
console.info(`Rendered ${examples.length} symbols and variants.`);
