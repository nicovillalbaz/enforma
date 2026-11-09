import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const demoRoot = resolve('.local/manual-demo');
export const demoDatabase = 'forma_manual_demo';
export const demoOrigin = 'http://127.0.0.1:4180';
export function demoDatabaseUrl(source) {
  if (process.env.NODE_ENV === 'production' || !source) throw new Error('LOCAL_DEMO_ONLY');
  const uri = new URL(source);
  if (
    !['localhost', '127.0.0.1'].includes(uri.hostname) ||
    uri.port !== '54329' ||
    uri.pathname !== '/forma'
  )
    throw new Error('LOCAL_DEMO_ONLY');
  uri.pathname = '/' + demoDatabase;
  return uri.toString();
}
export async function demoConfig() {
  const config = JSON.parse(await readFile(resolve(demoRoot, 'config.json'), 'utf8'));
  if (
    config.format !== 1 ||
    config.database !== demoDatabase ||
    !/^[a-f0-9-]{36}$/.test(config.instanceId) ||
    typeof config.password !== 'string' ||
    config.password.length < 16 ||
    typeof config.cookieSecret !== 'string' ||
    config.cookieSecret.length < 32
  )
    throw new Error('INVALID_DEMO_PROFILE');
  demoDatabaseUrl(process.env.DATABASE_ADMIN_URL);
  demoDatabaseUrl(process.env.DATABASE_URL);
  return config;
}
