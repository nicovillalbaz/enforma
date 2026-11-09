import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const slugs = [
  'treadmill-incline-walk',
  'assault-bike',
  'elliptical',
  'jump-rope',
  'deadlift',
  'romanian-deadlift',
];
const panels = [];
for (const [row, slug] of slugs.entries()) {
  for (const frame of [1, 2, 3]) {
    const source = await readFile(`apps/web/public/exercise-art/${slug}/frame-${frame}.svg`);
    panels.push({
      input: await sharp(source).resize(200, 200).png().toBuffer(),
      left: (frame - 1) * 200,
      top: row * 200,
    });
  }
}
await mkdir('.local/art-review', { recursive: true });
await sharp({
  create: { width: 600, height: slugs.length * 200, channels: 4, background: '#f7fafc' },
})
  .composite(panels)
  .png()
  .toFile('.local/art-review/frames.png');
console.info('Three frames per exercise: .local/art-review/frames.png');
