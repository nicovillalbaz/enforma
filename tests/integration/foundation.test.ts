import 'dotenv/config';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import sharp from 'sharp';
import { sql } from 'kysely';
import { createDatabase, withOrganization } from '@forma/db';
import { isolatedDatabase } from '../helpers/database.js';
import { claimJob, finishJob } from '../../packages/db/src/jobs.js';
import { buildApp } from '../../apps/api/src/app.js';
import { hashPassword } from '../../apps/api/src/security.js';
import { PrivateStorage } from '../../apps/api/src/storage.js';
import { createBackup, restoreDrill } from '../../scripts/backup.js';

const fixture = isolatedDatabase();
let directory: string;
const admin = new pg.Pool({
  connectionString: fixture.url(process.env.DATABASE_ADMIN_URL),
  max: 3,
});
const api = createDatabase(fixture.url(process.env.DATABASE_URL));
const worker = new pg.Pool({
  connectionString: fixture.url(process.env.WORKER_DATABASE_URL),
  max: 3,
});
const a = '30000000-0000-4000-8000-000000000001',
  b = '30000000-0000-4000-8000-000000000002',
  user = '40000000-0000-4000-8000-000000000001';
beforeAll(async () => {
  directory = await fixture.create();
  await admin.query(
    "INSERT INTO app_users(id,email,password_hash,full_name)VALUES($1,'integration@example.test',$2,'Integration User') ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash",
    [user, await hashPassword('Integration-password-2026!')],
  );
  await admin.query(
    "INSERT INTO organizations(id,name,slug)VALUES($1,'Test A','integration-a'),($2,'Test B','integration-b')ON CONFLICT DO NOTHING",
    [a, b],
  );
  await admin.query(
    "INSERT INTO organization_memberships(organization_id,user_id,role)VALUES($1,$2,'owner')ON CONFLICT DO NOTHING",
    [a, user],
  );
  await admin.query(
    "INSERT INTO audit_logs(organization_id,actor_user_id,action)VALUES($1,$3,'test.a'),($2,$3,'test.b')",
    [a, b, user],
  );
});
afterAll(async () => {
  await api.destroy();
  await worker.end();
  await admin.end();
  await fixture.drop();
});
describe('PostgreSQL boundaries', () => {
  it('fails closed without organization context and scopes to the verified member', async () => {
    expect(await api.selectFrom('audit_logs').selectAll().execute()).toEqual([]);
    const visible = await withOrganization(api, { organizationId: a, userId: user }, (trx) =>
      trx.selectFrom('audit_logs').selectAll().execute(),
    );
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((row) => row.organization_id === a)).toBe(true);
    expect(
      await withOrganization(api, { organizationId: b, userId: user }, (trx) =>
        trx.selectFrom('audit_logs').selectAll().execute(),
      ),
    ).toEqual([]);
    expect(await api.selectFrom('audit_logs').selectAll().execute()).toEqual([]);
  });
  it('prevents cross-organization writes and schema changes by the API role', async () => {
    await expect(
      withOrganization(api, { organizationId: a, userId: user }, (trx) =>
        sql`INSERT INTO audit_logs(organization_id,action)VALUES(${b},'cross-tenant')`.execute(trx),
      ),
    ).rejects.toThrow();
    await expect(sql`CREATE TABLE forbidden_table(id integer)`.execute(api)).rejects.toThrow();
  });
  it('claims a job only once across concurrent workers and clears sensitive payload on completion', async () => {
    const key = `test-${crypto.randomUUID()}`;
    await admin.query('INSERT INTO jobs(kind,deduplication_key,payload)VALUES($1,$2,$3)', [
      key,
      key,
      JSON.stringify({ test: true }),
    ]);
    const claimed = await Promise.all([claimJob(worker, [key]), claimJob(worker, [key])]);
    const jobs = claimed.filter((j) => j !== undefined);
    expect(jobs).toHaveLength(1);
    expect(new Set(jobs.map((j) => j.id)).size).toBe(jobs.length);
    for (const job of jobs) await finishJob(worker, job);
    expect(
      (await admin.query('SELECT payload,status FROM jobs WHERE deduplication_key=$1', [key]))
        .rows[0],
    ).toEqual({ payload: {}, status: 'completed' });
  });
  it('logs in, revokes a session and consumes recovery tokens once', async () => {
    const server = await buildApp({
      origin: 'http://127.0.0.1:5173',
      cookieSecret: 'integration-cookie-secret-at-least-32-chars',
      databaseUrl: fixture.url(process.env.DATABASE_URL),
    });
    try {
      const csrf = await server.inject('/v1/security/csrf');
      const cookies = String(csrf.headers['set-cookie']).split(';')[0]!;
      const headers = { cookie: cookies, 'x-csrf-token': csrf.json().token };
      const login = await server.inject({
        method: 'POST',
        url: '/v1/auth/login',
        headers,
        payload: { email: 'integration@example.test', password: 'Integration-password-2026!' },
      });
      expect(login.statusCode).toBe(200);
      const session = String(login.headers['set-cookie']).split(';')[0]!;
      expect(
        (await server.inject({ url: '/v1/auth/me', headers: { cookie: session } })).json().user.id,
      ).toBe(user);
      await server.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        headers: { ...headers, cookie: `${cookies}; ${session}` },
      });
      expect(
        (await server.inject({ url: '/v1/auth/me', headers: { cookie: session } })).statusCode,
      ).toBe(401);
      const recovery = await server.inject({
        method: 'POST',
        url: '/v1/auth/password-reset',
        headers,
        payload: { email: 'integration@example.test' },
      });
      expect(recovery.statusCode).toBe(200);
      const payload = (
        await admin.query<{ payload: { url: string } }>(
          "SELECT payload FROM jobs WHERE kind='email.password_reset' AND payload->>'to'='integration@example.test' ORDER BY created_at DESC LIMIT 1",
        )
      ).rows[0]!.payload;
      const token = new URL(payload.url).searchParams.get('token');
      const reset = {
        method: 'POST' as const,
        url: '/v1/auth/password-reset/confirm',
        headers,
        payload: { token, password: 'New-integration-password!' },
      };
      expect((await server.inject(reset)).statusCode).toBe(200);
      expect((await server.inject(reset)).statusCode).toBe(400);
      await admin.query(
        "UPDATE jobs SET status='completed',payload='{}' WHERE kind='email.password_reset' AND payload->>'to'='integration@example.test'",
      );
    } finally {
      await server.close();
    }
  });
  it('restores an encrypted database and private media in isolation', async () => {
    const studentId = crypto.randomUUID();
    await admin.query(
      "INSERT INTO students(id,organization_id,display_name,contact_email,status) VALUES($1,$2,'Alumno de restauración','restore-anthro@example.test','active')",
      [studentId, a],
    );
    await admin.query(
      "INSERT INTO anthropometry_assessments(organization_id,student_id,request_id,protocol,assessed_on,created_by,notes) VALUES($1,$2,$3,'free',current_date,$4,'Dato ficticio de respaldo')",
      [a, studentId, crypto.randomUUID(), user],
    );
    const storage = new PrivateStorage(directory);
    const picture = await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#005ea8' },
    })
      .webp()
      .toBuffer();
    const key = await storage.put(picture, 'webp');
    await admin.query(
      "INSERT INTO organization_logo_assets(organization_id,storage_key,byte_size,mime_type)VALUES($1,$2,$3,'image/webp')",
      [a, key, picture.length],
    );
    const options = {
      connectionString: fixture.url(process.env.DATABASE_ADMIN_URL),
      storageRoot: directory,
    };
    const artifact = await createBackup(options);
    expect(await restoreDrill(artifact, options)).toMatchObject({
      database: 'verified',
      privateReferences: 'verified',
      recordCounts: 87,
      isolated: true,
    });
    await storage.remove(key);
    await expect(createBackup(options)).rejects.toThrow(
      'database-referenced private file is missing',
    );
  });
});
