import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { preview } from 'vite';
import { buildApp } from '../apps/api/src/app.ts';
import { inspectWebRelease } from './web-release.ts';
import { demoConfig, demoDatabaseUrl, demoOrigin, demoRoot } from './manual-demo-config.mjs';

let app, web;
async function close() {
  await web?.close();
  await app?.close();
}
try {
  const config = await demoConfig();
  if (!config.ready) throw new Error('DEMO_NOT_PREPARED');
  if ((await inspectWebRelease()).status !== 'verified') throw new Error('CURRENT_BUILD_REQUIRED');
  app = await buildApp({
    origin: demoOrigin,
    cookieSecret: config.cookieSecret,
    databaseUrl: demoDatabaseUrl(process.env.DATABASE_URL),
    storageRoot: resolve(demoRoot, 'storage'),
    developmentMailbox: true,
  });
  app.get('/v1/manual-demo/instance', async () => ({
    instanceId: config.instanceId,
    synthetic: true,
    loopbackOnly: true,
  }));
  await app.listen({ host: '127.0.0.1', port: 3010 });
  web = await preview({
    configFile: 'apps/web/vite.config.ts',
    preview: {
      host: '127.0.0.1',
      port: 4180,
      strictPort: true,
      proxy: { '/v1': { target: 'http://127.0.0.1:3010', ws: true } },
    },
  });
  await writeFile(
    resolve(demoRoot, 'server.json'),
    JSON.stringify(
      {
        pid: process.pid,
        instanceId: config.instanceId,
        origin: demoOrigin,
        startedAt: new Date().toISOString(),
        loopbackOnly: true,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, async () => {
      await close();
      process.exit(0);
    });
  console.info('Private local synthetic demo ready: ' + demoOrigin + '/acceso');
} catch (error) {
  await close();
  console.error(
    'Local demo could not start. Check preparation, build and ports 3010/4180.',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
}
