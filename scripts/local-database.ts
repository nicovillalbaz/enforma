import 'dotenv/config';
import { access, mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import pg from 'pg';

const root = resolve('.local/postgres');
const pgBin =
  process.env.PG_BIN ??
  (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/16/bin' : '/usr/bin');
const suffix = process.platform === 'win32' ? '.exe' : '';
export const binary = (name: string) => join(pgBin, name + suffix);
async function run(name: string, args: string[]) {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(binary(name), args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', (part) => {
      output += String(part);
    });
    child.stderr.on('data', (part) => {
      output += String(part);
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`${name} failed: ${output.slice(-1600)}`)),
    );
  });
}
if (!process.env.DATABASE_ADMIN_URL) throw new Error('Run npm run setup first');
const uri = new URL(process.env.DATABASE_ADMIN_URL);
if (!['127.0.0.1', 'localhost'].includes(uri.hostname) || uri.pathname !== '/forma')
  throw new Error('Local database commands require the local forma database');
await mkdir(root, { recursive: true });
if (process.argv.includes('stop')) {
  await run('pg_ctl', ['-D', root, 'stop', '-m', 'fast']);
  console.info('Local project database stopped.');
} else {
  try {
    await access(join(root, 'PG_VERSION'));
  } catch {
    const passwordFile = resolve('.local/postgres-init-password');
    await writeFile(passwordFile, decodeURIComponent(uri.password), { mode: 0o600 });
    try {
      await run('initdb', [
        '-D',
        root,
        '-U',
        decodeURIComponent(uri.username),
        '--auth=scram-sha-256',
        '--encoding=UTF8',
        '--locale=C',
        '--pwfile',
        passwordFile,
      ]);
    } finally {
      await unlink(passwordFile);
    }
  }
  try {
    await run('pg_ctl', ['-D', root, 'status']);
  } catch {
    await run('pg_ctl', [
      '-D',
      root,
      '-l',
      resolve('.local/postgres.log'),
      '-o',
      `-h 127.0.0.1 -p ${Number(uri.port)}`,
      '-w',
      'start',
    ]);
  }
  const admin = new pg.Client({ connectionString: new URL('/postgres', uri).toString() });
  await admin.connect();
  try {
    if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='forma'")).rowCount)
      await admin.query('CREATE DATABASE forma');
  } finally {
    await admin.end();
  }
  console.info(
    `Project PostgreSQL is ready on 127.0.0.1:${uri.port}. Existing external databases were not modified.`,
  );
}
// pg_ctl starts a persistent database. Do not retain its inherited pipe handles in this CLI.
process.exit(0);
