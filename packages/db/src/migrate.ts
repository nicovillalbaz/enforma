import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export async function migrate(connectionString = process.env.DATABASE_ADMIN_URL) {
  if (!connectionString) throw new Error('DATABASE_ADMIN_URL is required');
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock(70241020)');
    for (const [role, password] of [
      ['forma_api', process.env.API_DATABASE_PASSWORD],
      ['forma_worker', process.env.WORKER_DATABASE_PASSWORD],
    ] as const) {
      const exists = await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role]);
      if (!exists.rowCount) {
        if (!password) throw new Error(`A password is required to bootstrap ${role}`);
        await client.query(
          `CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD '${password.replaceAll("'", "''")}'`,
        );
      }
    }
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const dir = new URL('../migrations/', import.meta.url);
    for (const name of (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort()) {
      const source = await readFile(new URL(name, dir), 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const existing = await client.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE name=$1',
        [name],
      );
      if (existing.rowCount) {
        if (existing.rows[0]?.checksum !== checksum)
          throw new Error(`Applied migration was modified: ${name}`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(source);
        await client.query('INSERT INTO schema_migrations (name,checksum) VALUES ($1,$2)', [
          name,
          checksum,
        ]);
        await client.query('COMMIT');
        console.info(`Applied ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(70241020)');
    await client.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate().catch(() => {
    console.error('Migration failed. Check database access and migration SQL.');
    process.exitCode = 1;
  });
}
