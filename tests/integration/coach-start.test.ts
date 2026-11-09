import { approveFixtureCoach } from '../helpers/coach-approval.js';
import 'dotenv/config';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../../apps/api/src/app.js';
import { actorTransaction } from '../../apps/api/src/organizations.js';
import { isolatedDatabase } from '../helpers/database.js';
import { dateShift, freshSet } from '@forma/shared';
const fixture = isolatedDatabase(),
  admin = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_ADMIN_URL), max: 2 }),
  api = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_URL), max: 1 });
let server: Awaited<ReturnType<typeof buildApp>>,
  ip = 1;
function client() {
  let cookie = '',
    csrf = '';
  const address = `127.0.3.${ip++}`;
  return {
    get cookies() {
      return cookie;
    },
    async call(
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
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
  await approveFixtureCoach(admin, r.json().organizationId);
  const userId = (await http.call('GET', '/v1/auth/me')).json().user.id;
  await admin.query('UPDATE app_users SET email_verified_at=now() WHERE id=$1', [userId]);
  return { http, id: r.json().organizationId as string, userId };
}
type Coach = Awaited<ReturnType<typeof coach>>;
async function pupil(owner: Coach, label: string) {
  const email = `${label.replaceAll(' ', '-')}-${randomUUID().slice(0, 8)}@example.test`;
  const created = await owner.http.call('POST', `/v1/organizations/${owner.id}/students`, {
    displayName: label,
    email,
    goal: 'Fuerza',
  });
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json().student.id as string;
  const invitation = (
    await owner.http.call('POST', `/v1/organizations/${owner.id}/students/${id}/invitation`)
  ).json().url;
  const http = client();
  const r = await http.call('POST', '/v1/invitations/accept', {
    token: new URL(invitation).searchParams.get('token'),
    fullName: label,
    goal: 'Fuerza',
    password: 'Student-programs-2026!',
    privacyAccepted: true,
  });
  expect(r.statusCode, r.body).toBe(200);
  return { id, email, http, userId: (await http.call('GET', '/v1/auth/me')).json().user.id };
}

let a: Coach, b: Coach, s: Awaited<ReturnType<typeof pupil>>, today: string;
const root = (owner = a) => `/v1/organizations/${owner.id}/coach-start`;
beforeAll(async () => {
  const storage = await fixture.create();
  server = await buildApp({
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    storageRoot: storage,
    origin: 'http://localhost:5173',
    cookieSecret: 'coach-start-test-secret-at-least-32-bytes',
  });
  await server.ready();
  a = await coach('independent-a');
  b = await coach('independent-b');
  today = (await a.http.call('GET', root())).json().today;
});
afterAll(async () => {
  await server?.close();
  await api.end();
  await admin.end();
  await fixture.drop();
});

it('restricts new registrations to independent coaches in API and DB without granting the old constructor', async () => {
  const newClient = client(),
    email = 'blocked-' + randomUUID() + '@example.test';
  const body = {
    fullName: 'No crear gimnasio',
    email,
    password: 'Programs-password-2026!',
    name: 'Gimnasio bloqueado',
    slug: 'blocked-' + randomUUID().slice(0, 8),
    kind: 'gym',
    accent: '#005ea8',
    plan: 'basic',
    privacyAccepted: true,
  };
  const response = await newClient.call('POST', '/v1/auth/register-coach', body);
  expect(response.statusCode, response.body).toBe(400);
  expect(
    (await admin.query('SELECT count(*) n FROM app_users WHERE email=$1', [email])).rows[0].n,
  ).toBe('0');
  expect(
    (
      await a.http.call('POST', '/v1/organizations', {
        name: 'No gimnasio',
        slug: 'blocked-' + randomUUID().slice(0, 8),
        kind: 'gym',
        accent: '#005ea8',
        plan: 'basic',
      })
    ).statusCode,
  ).toBe(400);
  await expect(
    actorTransaction(api, a.userId, a.id, (db) =>
      db.query("SELECT app.create_organization('No gimnasio',$1,'gym','#005ea8','basic')", [
        'blocked-' + randomUUID().slice(0, 8),
      ]),
    ),
  ).rejects.toMatchObject({ message: 'INDEPENDENT_COACH_ONLY' });
  expect(
    (
      await admin.query(
        "SELECT has_function_privilege('forma_api','app.create_organization_t12(text,text,text,text,text)','EXECUTE') allowed",
      )
    ).rows[0].allowed,
  ).toBe(false);
  expect(
    (await admin.query('SELECT kind FROM organizations WHERE id=$1', [a.id])).rows[0].kind,
  ).toBe('coach');
});

it('reports real setup and whole-study student counts without returning contact lists', async () => {
  const initial = (await a.http.call('GET', root())).json();
  expect(initial).toMatchObject({
    brandReady: true,
    emailVerified: true,
    activeStudents: 0,
    invitedStudents: 0,
    publishedPrograms: 0,
    currentAssignments: 0,
    upcomingSessions: 0,
  });
  await admin.query('UPDATE app_users SET email_verified_at=NULL WHERE id=$1', [a.userId]);
  expect((await a.http.call('GET', root())).json().emailVerified).toBe(false);
  await admin.query('UPDATE app_users SET email_verified_at=now() WHERE id=$1', [a.userId]);
  const invite = await a.http.call('POST', `/v1/organizations/${a.id}/students`, {
    displayName: 'Ficha sin aceptar',
    email: 'pending-' + randomUUID() + '@example.test',
    goal: '',
  });
  expect(invite.statusCode, invite.body).toBe(201);
  s = await pupil(a, 'Alumno independiente');
  const current = (await a.http.call('GET', root())).json();
  expect(current).toMatchObject({
    activeStudents: 1,
    invitedStudents: 1,
    publishedPrograms: 0,
    currentAssignments: 0,
  });
  expect(JSON.stringify(current)).not.toContain(s.email);
  expect(JSON.stringify(current)).not.toContain('Alumno independiente');
  expect((await b.http.call('GET', root(b))).json().activeStudents).toBe(0);
  await admin.query("UPDATE students SET status='paused' WHERE id=$1", [s.id]);
  expect((await a.http.call('GET', root())).json().activeStudents).toBe(0);
  await admin.query("UPDATE students SET status='active' WHERE id=$1", [s.id]);
});

it('counts distinct published routines and only assignments for active students that have not ended', async () => {
  s ??= await pupil(a, 'Alumno independiente');
  const program = randomUUID(),
    v1 = randomUUID(),
    v2 = randomUUID(),
    batch = randomUUID(),
    assignment = randomUUID();
  const document = {
    name: 'Rutina QA',
    description: 'Fixture estructural del resumen',
    isTemplate: false,
    weeks: [
      {
        id: randomUUID(),
        name: 'Semana 1',
        days: [
          {
            id: randomUUID(),
            name: 'Día 1',
            weekday: 1,
            notes: '',
            exercises: [
              { id: randomUUID(), exerciseId: randomUUID(), notes: '', sets: [freshSet()] },
            ],
          },
        ],
      },
    ],
  };
  await admin.query(
    'INSERT INTO training_programs(id,organization_id,document,created_by)VALUES($1,$2,$3,$4)',
    [program, a.id, document, a.userId],
  );
  for (const [id, number] of [
    [v1, 1],
    [v2, 2],
  ] as const)
    await admin.query(
      'INSERT INTO program_versions(id,organization_id,program_id,number,source_revision,snapshot,created_by)VALUES($1,$2,$3,$4,$4,$5,$6)',
      [id, a.id, program, number, document, a.userId],
    );
  expect((await a.http.call('GET', root())).json().publishedPrograms).toBe(1);
  await admin.query(
    'INSERT INTO program_assignment_batches(id,organization_id,request_id,payload_hash,created_by)VALUES($1,$2,$3,$4,$5)',
    [batch, a.id, randomUUID(), 'fixture-hash', a.userId],
  );
  await admin.query(
    'INSERT INTO program_assignments(id,organization_id,version_id,student_id,batch_id,starts_on,ends_on,created_by)VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [assignment, a.id, v2, s.id, batch, today, dateShift(today, 7), a.userId],
  );
  expect((await a.http.call('GET', root())).json().currentAssignments).toBe(1);
  await admin.query("UPDATE students SET status='paused' WHERE id=$1", [s.id]);
  expect((await a.http.call('GET', root())).json().currentAssignments).toBe(0);
  await admin.query("UPDATE students SET status='active' WHERE id=$1", [s.id]);
  await admin.query('UPDATE program_assignments SET starts_on=$2,ends_on=$3 WHERE id=$1', [
    assignment,
    dateShift(today, -8),
    dateShift(today, -1),
  ]);
  expect((await a.http.call('GET', root())).json().currentAssignments).toBe(0);
  await admin.query('UPDATE training_programs SET archived=true WHERE id=$1', [program]);
  expect((await a.http.call('GET', root())).json().publishedPrograms).toBe(0);
});

it('limits the start overview to the active owner of the current study', async () => {
  s ??= await pupil(a, 'Alumno independiente');
  expect((await s.http.call('GET', root())).statusCode).toBe(403);
  expect((await a.http.call('GET', root(b))).statusCode).toBe(404);
  expect((await client().call('GET', root())).statusCode).toBe(401);
  await admin.query(
    "INSERT INTO organization_memberships(organization_id,user_id,role,status)VALUES($1,$2,'coach','active')",
    [a.id, b.userId],
  );
  expect((await b.http.call('GET', root())).statusCode).toBe(403);
  await expect(
    actorTransaction(api, a.userId, b.id, (db) => db.query('SELECT app.coach_start_overview()')),
  ).rejects.toMatchObject({ message: 'FORBIDDEN' });
  await admin.query("UPDATE organizations SET status='suspended' WHERE id=$1", [b.id]);
  expect((await b.http.call('GET', root(b))).statusCode).toBe(403);
});
