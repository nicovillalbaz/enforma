/* global navigator:readonly */
import { createServer } from 'node:http';
import { writeFile, mkdir } from 'node:fs/promises';
import { chromium, webkit } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
  results = [];
for (const [engine, type] of Object.entries({ chromium, webkit }))
  for (const mode of ['literal', 'cache-only'])
    for (const outage of ['offline-flag', 'origin-stopped']) {
      const server = createServer((req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        if (req.url === '/sw.js') {
          res.setHeader('Content-Type', 'text/javascript');
          res.end(
            "self.addEventListener('install',e=>e.waitUntil(caches.open('diagnostic-shell').then(c=>c.add('/index.html')).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')e.respondWith(" +
              (mode === 'literal'
                ? "new Response('<h1>Synthetic offline shell</h1>',{headers:{'Content-Type':'text/html'}})"
                : "caches.open('diagnostic-shell').then(c=>c.match('/index.html'))") +
              ');});',
          );
        } else {
          res.setHeader('Content-Type', 'text/html');
          res.end(
            req.url === '/index.html'
              ? '<h1>Synthetic offline shell</h1>'
              : '<h1>Synthetic origin</h1>',
          );
        }
      });
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const origin = `http://127.0.0.1:${server.address().port}`,
        browser = await type.launch(),
        context = await browser.newContext();
      let result = { engine, mode, outage, browser: browser.version() };
      const stop = async () => {
        if (server.listening)
          await new Promise((resolve) => {
            server.close(resolve);
            server.closeAllConnections();
          });
      };
      try {
        const p = await context.newPage();
        await p.goto(origin);
        await p.evaluate(async () => {
          await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
          if (!navigator.serviceWorker.controller)
            await new Promise((resolve) =>
              navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
            );
        });
        if (outage === 'offline-flag') await context.setOffline(true);
        else await stop();
        await p.close();
        const next = await context.newPage();
        try {
          const response = await next.goto(origin + '/new-document', { timeout: 10000 });
          result = {
            ...result,
            status: response?.status(),
            fromServiceWorker: response?.fromServiceWorker(),
            heading: await next.locator('h1').textContent(),
          };
        } catch (e) {
          result.error = e.message;
        }
      } finally {
        await context.close();
        await browser.close();
        await stop();
      }
      results.push(result);
    }
await mkdir('docs/evidencias', { recursive: true });
const report = {
  date: new Date().toISOString(),
  platform: process.platform,
  playwright: require('@playwright/test/package.json').version,
  scope: 'Loopback synthetic literal response; no Forma code or data',
  results,
};
await writeFile(
  'docs/evidencias/t05-webkit-diagnostic.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(report);
