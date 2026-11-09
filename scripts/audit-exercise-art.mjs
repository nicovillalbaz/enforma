/* Raster measurements of the shipped vector artwork, without changing assets. */
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { exerciseFramePairs } from '../apps/web/src/exercise-frame-pairs.ts';

const rows = [];
for (const slug of Object.keys(exerciseFramePairs)) {
  for (const frame of [1, 2, 3]) {
    const path = `apps/web/public/exercise-art/${slug}/frame-${frame}.svg`;
    const source = await readFile(path);
    const { data, info } = await sharp(source)
      .resize(256, 256)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ink = (x, y) =>
      x >= 0 && x < 256 && y >= 0 && y < 256 && data[(y * 256 + x) * info.channels + 3] > 127;
    let area = 0,
      perimeter = 0,
      minX = 256,
      minY = 256,
      maxX = 0,
      maxY = 0;
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        if (!ink(x, y)) continue;
        area++;
        perimeter +=
          Number(!ink(x - 1, y)) +
          Number(!ink(x + 1, y)) +
          Number(!ink(x, y - 1)) +
          Number(!ink(x, y + 1));
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    rows.push({
      slug,
      frame,
      effectiveInk: Number(((2 * area) / perimeter).toFixed(2)),
      height: maxY - minY + 1,
      width: maxX - minX + 1,
      area,
    });
  }
}
await writeFile(
  'docs/evidencias/exercise-art-ink-audit.json',
  JSON.stringify(rows, null, 2) + '\n',
);
const weights = rows.map((row) => row.effectiveInk).sort((a, b) => a - b);
console.info(
  JSON.stringify({
    pairs: rows.length,
    min: weights[0],
    median: weights[Math.floor(weights.length / 2)],
    max: weights.at(-1),
    narrowest: rows.toSorted((a, b) => a.effectiveInk - b.effectiveInk).slice(0, 8),
    heaviest: rows.toSorted((a, b) => b.effectiveInk - a.effectiveInk).slice(0, 8),
  }),
);
