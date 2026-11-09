import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { writeWebRelease } from './web-release.ts';
import { exerciseFramePairs } from '../apps/web/src/exercise-frame-pairs.ts';
const root = resolve('dist/web');
for (const size of [192, 512])
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#071022"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="${size * 0.48}" font-weight="700" fill="#19e7d0">F</text></svg>`,
    ),
  )
    .png()
    .toFile(join(root, `app-icon-${size}.png`));
await writeFile(
  join(root, 'manifest.webmanifest'),
  JSON.stringify({
    id: '/app-id/forma',
    name: 'Forma',
    short_name: 'Forma',
    lang: 'es',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#071022',
    background_color: '#071022',
    icons: [
      { src: '/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }),
);
async function files(path = '') {
  const result = [];
  for (const f of await readdir(join(root, path), { withFileTypes: true })) {
    const name = path + '/' + f.name;
    if (f.isDirectory()) result.push(...(await files(name)));
    else if (name !== '/sw.js') result.push(name);
  }
  return result;
}
const viteManifest = JSON.parse(await readFile(join(root, '.vite', 'manifest.json'), 'utf8'));
const currentBundles = new Set(
  Object.values(viteManifest)
    .flatMap((entry) => [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])])
    .filter(Boolean)
    .map((path) => '/' + path),
);
const assets = (await files())
    .filter((path) => {
      if (path.startsWith('/.vite/')) return false;
      if (path.startsWith('/assets/')) return currentBundles.has(path);
      const match = /^\/exercise-art\/([^/]+)\/frame-(\d)\.svg$/.exec(path);
      return !match || exerciseFramePairs[match[1]]?.includes(Number(match[2]));
    })
    .sort(),
  digest = createHash('sha256');
for (const path of assets) digest.update(path).update(await readFile(join(root, path)));
const hash = digest.digest('hex').slice(0, 16);
await writeFile(
  join(root, 'sw.js'),
  `const CACHE='forma-shell-${hash}',ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('forma-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/v1/')||req.headers.has('range'))return;
 if(req.mode==='navigate'){event.respondWith(fetch(req).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));return;}
 if(ASSETS.includes(url.pathname))event.respondWith(caches.open(CACHE).then(cache=>cache.match(url.pathname)).then(asset=>asset||fetch(req)));
});
`,
);
console.log(
  'Offline public shell built:',
  assets.length,
  'assets. Private API and media excluded.',
);
const release = await writeWebRelease();
console.log(
  'Web release manifest written:',
  release.sources.files,
  'source files,',
  release.artifacts.files,
  'artifacts.',
);
