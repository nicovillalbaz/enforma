// Keep each three-frame sequence in one stable crop and one consistent ink weight.
// Run after fetch-exercise-art.mjs. --preview writes six samples under .local/.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { exerciseArtworkSlugs } from '../apps/web/src/exercise-artwork.ts';

const preview = process.argv.includes('--preview');
const sourceRoot = resolve('apps/web/public/exercise-art');
const outputRoot = preview ? resolve('.local/art-normalization-preview') : sourceRoot;
const selected = preview
  ? [
      'bench-press',
      'dumbbell-bench-press',
      'machine-chest-press',
      'goblet-squat',
      'lat-pulldown',
      'leg-press',
    ]
  : exerciseArtworkSlugs;
const minimumInkWidth = 3.5;
const summary = [];
const previous = JSON.parse(
  await readFile(resolve(outputRoot, 'NORMALIZATION.json'), 'utf8').catch(() => '{"samples":[]}'),
);
const previousBySlug = new Map(previous.samples.map((entry) => [entry.slug, entry]));

async function measure(svg) {
  const { data, info } = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const ink = (x, y) =>
    x >= 0 && x < width && y >= 0 && y < height && data[(y * width + x) * channels + 3] > 127;
  let area = 0,
    perimeter = 0,
    minX = width,
    minY = height,
    maxX = 0,
    maxY = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (ink(x, y)) {
        area += 1;
        perimeter +=
          Number(!ink(x - 1, y)) +
          Number(!ink(x + 1, y)) +
          Number(!ink(x, y - 1)) +
          Number(!ink(x, y + 1));
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
  if (!area || !perimeter) throw new Error('Empty illustration');
  return { weight: (2 * area) / perimeter, minX, minY, maxX, maxY };
}

for (const slug of selected) {
  const original = await Promise.all(
    [1, 2, 3].map((frame) => readFile(resolve(sourceRoot, slug, `frame-${frame}.svg`), 'utf8')),
  );
  if (original.some((svg) => svg.includes('data-forma-normalized='))) {
    summary.push(previousBySlug.get(slug) ?? { slug, normalized: true });
    continue;
  }
  const dimensions = await Promise.all(original.map(measure));
  const left = Math.min(...dimensions.map((entry) => entry.minX));
  const top = Math.min(...dimensions.map((entry) => entry.minY));
  const right = Math.max(...dimensions.map((entry) => entry.maxX));
  const bottom = Math.max(...dimensions.map((entry) => entry.maxY));
  const size = Math.ceil(Math.max(right - left, bottom - top) / 0.84);
  const x = Math.round((left + right - size) / 2);
  const y = Math.round((top + bottom - size) / 2);
  const directory = resolve(outputRoot, slug);
  await mkdir(directory, { recursive: true });
  const targetInkWidth = Math.max(
    minimumInkWidth,
    Math.min(6, Math.max(...dimensions.map((entry) => entry.weight))),
  );
  for (const [index, svg] of original.entries()) {
    const weight = dimensions[index].weight;
    const strokeWidth = Math.min(4, Math.max(0, targetInkWidth - weight));
    const stroke =
      strokeWidth >= 0.3
        ? `stroke="#14263d" stroke-width="${strokeWidth.toFixed(2)}" stroke-linejoin="round" paint-order="stroke fill" `
        : '';
    const lightening = weight > 7.2 ? 'fill-opacity="0.84" ' : '';
    const normalized = svg
      .replace(
        'viewBox="0 0 512 512"',
        `viewBox="${x} ${y} ${size} ${size}" data-forma-normalized="v1"`,
      )
      .replace('<path ', `<path ${stroke}${lightening}`);
    await writeFile(resolve(directory, `frame-${index + 1}.svg`), normalized);
  }
  summary.push({
    slug,
    before: dimensions.map(({ weight }) => Number(weight.toFixed(2))),
    targetInkWidth,
    viewBox: [x, y, size, size],
  });
}
await writeFile(
  resolve(outputRoot, 'NORMALIZATION.json'),
  JSON.stringify({ minimumInkWidth, samples: summary }, null, 2) + '\n',
);
console.info(`Reviewed ${summary.length} exercise sequences${preview ? ' (preview)' : ''}.`);
