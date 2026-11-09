import { approveFixtureCoach } from '../helpers/coach-approval.js';
import 'dotenv/config';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../../apps/api/src/app.js';
import { isolatedDatabase } from '../helpers/database.js';
const fixture = isolatedDatabase(),
  admin = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_ADMIN_URL), max: 3 }),
  api = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_URL), max: 3 }),
  worker = new pg.Pool({ connectionString: fixture.url(process.env.WORKER_DATABASE_URL), max: 3 });
let server: Awaited<ReturnType<typeof buildApp>>,
  directory: string,
  ip = 1;
function client() {
  let cookie = '',
    csrf = '';
  const address = `127.0.3.${ip++}`;
  return {
    async call(
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      url: string,
      body?: unknown,
      headers: Record<string, string> = {},
    ) {
      if (!csrf) {
        const r = await server.inject({ url: '/v1/security/csrf', remoteAddress: address });
        csrf = r.json().token;
        cookie = String(r.headers['set-cookie']).split(';')[0]!;
      }
      const r = await server.inject({
        method,
        url,
        remoteAddress: address,
        headers: { cookie, 'x-csrf-token': csrf, ...headers },
        ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
      });
      const set = r.headers['set-cookie'];
      for (const v of set ? (Array.isArray(set) ? set : [set]) : []) {
        const pair = v.split(';')[0]!,
          name = pair.split('=')[0]!;
        cookie = cookie
          .split('; ')
          .filter((x) => !x.startsWith(name + '='))
          .concat(pair)
          .join('; ');
      }
      return r;
    },
  };
}
async function coach(label: string) {
  const http = client(),
    suffix = randomUUID().slice(0, 8);
  const r = await http.call('POST', '/v1/auth/register-coach', {
    fullName: 'Coach Rutinas',
    email: `${label}-${suffix}@example.test`,
    password: 'Programs-password-2026!',
    name: 'Programas ' + label,
    slug: `program-${label}-${suffix}`,
    kind: 'coach',
    accent: '#005ea8',
    plan: 'basic',
    privacyAccepted: true,
  });
  expect(r.statusCode, r.body).toBe(201);
  await approveFixtureCoach(admin, r.json().organizationId, { legacy: true });
  const userId = (await http.call('GET', '/v1/auth/me')).json().user.id;
  await admin.query('UPDATE app_users SET email_verified_at=now() WHERE id=$1', [userId]);
  return { http, id: r.json().organizationId as string, userId };
}
type Coach = Awaited<ReturnType<typeof coach>>;

const owners: Coach[] = [];
beforeAll(async () => {
  directory = await fixture.create();
  server = await buildApp({
    origin: 'http://127.0.0.1:5173',
    cookieSecret: 'pilot-load-local-secret-minimum-32-characters',
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    storageRoot: directory,
    developmentMailbox: true,
  });
  const month =
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion',
      year: 'numeric',
      month: '2-digit',
    })
      .format(new Date())
      .slice(0, 7) + '-01';
  for (let i = 0; i < 5; i++) {
    const o = await coach('pilot-load-' + i);
    owners.push(o);
    await admin.query(
      "WITH u AS(INSERT INTO app_users(email,password_hash,full_name) SELECT 'pilot-'||$1::text||'-'||n::text||'@example.test',c.password_hash,'Persona sintética '||n::text FROM generate_series(1,10)n CROSS JOIN app_users c WHERE c.id=$1::uuid RETURNING id,email,full_name) INSERT INTO students(organization_id,display_name,contact_email,user_id,status)SELECT $2,full_name,email,id,'active' FROM u",
      [o.userId, o.id],
    );
    await admin.query(
      "INSERT INTO saas_billing_enrollments(organization_id,started_at,initial_plan_version_id,created_by,reason)VALUES($1,$3::date::timestamp AT TIME ZONE 'America/Asuncion','52000000-0000-4000-8000-000000000001',$2,'Fixture sintético de carga')",
      [o.id, o.userId, month],
    );
    await admin.query(
      "UPDATE saas_subscriptions SET trial_ends_at=$2::date::timestamp AT TIME ZONE 'America/Asuncion' WHERE organization_id=$1",
      [o.id, month],
    );
    await admin.query(
      "INSERT INTO student_billable_intervals(organization_id,student_id,opened_at)SELECT organization_id,id,$2::date::timestamp AT TIME ZONE 'America/Asuncion' FROM students WHERE organization_id=$1",
      [o.id, month],
    );
  }
}, 60000);
afterAll(async () => {
  await server?.close();
  await api.end();
  await worker.end();
  await admin.end();
  await fixture.drop();
});
it('serves 75 scoped reads for five concurrent synthetic coaches with 50 enabled students', async () => {
  const samples: number[] = [];
  let errors = 0;
  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);
  for (let round = 0; round < 15; round++)
    await Promise.all(
      owners.map(async (o) => {
        const path =
            `/v1/organizations/${o.id}` +
            ['/billing/preview?month=' + month, '/progress?limit=20', '/exercises?limit=20'][
              round % 3
            ],
          start = Date.now(),
          r = await o.http.call('GET', path);
        samples.push(Date.now() - start);
        if (r.statusCode !== 200) errors++;
        expect(r.statusCode, r.body).toBe(200);
        if (round % 3 === 0) expect(r.json().preview.lines).toHaveLength(10);
        if (round % 3 === 1) expect(r.json().students).toHaveLength(10);
      }),
    );
  samples.sort((a, b) => a - b);
  const result = {
    measuredAt: new Date().toISOString(),
    transport: 'Fastify inject + isolated PostgreSQL, no external network',
    actors: 5,
    enabledStudents: 50,
    requests: 75,
    concurrency: 5,
    p50Ms: samples[Math.floor(samples.length * 0.5)],
    p95Ms: samples[Math.floor(samples.length * 0.95)],
    maxMs: samples.at(-1),
    errors,
    scope: 'Synthetic local read workload, not a production capacity guarantee',
  };
  expect(errors).toBe(0);
  expect(result.p95Ms).toBeLessThan(3000);
  const { writeFile } = await import('node:fs/promises');
  await writeFile('docs/evidencias/t07-carga.json', JSON.stringify(result, null, 2) + '\n');
}, 60000);
