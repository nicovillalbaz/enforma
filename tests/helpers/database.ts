import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { migrate } from '../../packages/db/src/migrate.js';
export function isolatedDatabase() {
  const name = 'forma_test_' + randomUUID().replaceAll('-', '');
  let created = false;
  const url = (source: string | undefined) => {
    const result = new URL(source!);
    result.pathname = '/' + name;
    return result.toString();
  };
  return {
    url,
    async create() {
      const client = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
      await client.connect();
      try {
        await client.query(`CREATE DATABASE ${name}`);
        created = true;
      } finally {
        await client.end();
      }
      await migrate(url(process.env.DATABASE_ADMIN_URL));
      await mkdir(resolve('.local/test-storage'), { recursive: true });
      return await mkdtemp(join(resolve('.local/test-storage'), name + '-'));
    },
    async drop() {
      if (!created) return;
      if (!/^forma_test_[a-f0-9]{32}$/.test(name)) throw new Error('Invalid test database');
      const client = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
      await client.connect();
      try {
        await client.query(`DROP DATABASE ${name}`);
      } finally {
        await client.end();
      }
    },
  };
}
