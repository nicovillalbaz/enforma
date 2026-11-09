// Reproducible acquisition of the selected CC BY-SA 4.0 exercise illustrations.
// Run with: node_modules/.bin/tsx scripts/fetch-exercise-art.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { exerciseArtworkSlugs } from '../apps/web/src/exercise-artwork.ts';

const root = resolve('apps/web/public/exercise-art');
const tasks = exerciseArtworkSlugs.flatMap((slug) => [1, 2, 3].map((frame) => ({ slug, frame })));
let cursor = 0;
let completed = 0;

async function worker() {
  while (cursor < tasks.length) {
    const { slug, frame } = tasks[cursor++];
    const directory = resolve(root, slug);
    const destination = resolve(directory, `frame-${frame}.svg`);
    if ((await readFile(destination, 'utf8').catch(() => '')) !== '') continue;
    const url = `https://bryllim.github.io/workout-guide/frames/${slug}/frame-${frame}.svg`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    const svg = await response.text();
    if (!svg.startsWith('<svg') || !svg.includes('viewBox="0 0 512 512"'))
      throw new Error(`Unexpected SVG: ${url}`);
    // The upstream transparent white artwork is recolored for our light canvas.
    const recolored = svg.replaceAll('fill="#fff"', 'fill="#14263d"');
    await mkdir(directory, { recursive: true });
    await writeFile(destination, recolored);
    completed += 1;
  }
}

await Promise.all(Array.from({ length: 6 }, () => worker()));
console.log(`Saved ${completed} frames for ${exerciseArtworkSlugs.length} exercises.`);
