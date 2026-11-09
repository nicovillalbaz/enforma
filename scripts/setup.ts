import { access, mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

await mkdir('.local/storage', { recursive: true });
try {
  await access('.env');
  console.info('Using existing .env.');
} catch {
  const secret = () => randomBytes(24).toString('hex');
  const admin = secret();
  const api = secret();
  const worker = secret();
  await writeFile(
    '.env',
    [
      'NODE_ENV=development',
      'HOST=127.0.0.1',
      'PORT=3001',
      'APP_ORIGIN=http://127.0.0.1:5173',
      `DATABASE_ADMIN_URL=postgres://forma_admin:${admin}@127.0.0.1:54329/forma`,
      `DATABASE_URL=postgres://forma_api:${api}@127.0.0.1:54329/forma`,
      `WORKER_DATABASE_URL=postgres://forma_worker:${worker}@127.0.0.1:54329/forma`,
      `API_DATABASE_PASSWORD=${api}`,
      `WORKER_DATABASE_PASSWORD=${worker}`,
      `POSTGRES_PASSWORD=${admin}`,
      `COOKIE_SECRET=${secret()}`,
      `BACKUP_PASSPHRASE=${secret()}`,
      'STORAGE_PATH=.local/storage',
      'SMTP_HOST=127.0.0.1',
      'SMTP_PORT=1025',
      'SMTP_FROM=Forma <no-reply@localhost>',
      '',
    ].join('\n'),
    { mode: 0o600, flag: 'wx' },
  );
  console.info('Created local configuration with random secrets. No credentials were printed.');
}
