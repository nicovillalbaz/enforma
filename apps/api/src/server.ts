import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { buildApp } from './app.js';

const production = process.env.NODE_ENV === 'production';
if (production && !process.env.COOKIE_SECRET)
  throw new Error('COOKIE_SECRET is required in production');
const app = await buildApp({
  databaseUrl: process.env.DATABASE_URL,
  origin: process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173',
  cookieSecret: process.env.COOKIE_SECRET ?? randomBytes(32).toString('hex'),
  production,
  logger: true,
  tenantBaseDomain: process.env.TENANT_BASE_DOMAIN,
  developmentMailbox: !production,
  trustedProxyIp: process.env.TRUSTED_PROXY_IP,
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
await app.listen({ host: process.env.HOST ?? '127.0.0.1', port: Number(process.env.PORT ?? 3001) });
