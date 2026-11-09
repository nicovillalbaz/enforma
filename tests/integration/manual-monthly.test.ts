import 'dotenv/config';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../../apps/api/src/app.js';
import { actorTransaction } from '../../apps/api/src/organizations.js';
import { isolatedDatabase } from '../helpers/database.js';
const fixture = isolatedDatabase(),
  admin = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_ADMIN_URL), max: 1 }),
  sql = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_URL), max: 1 });
let server: Awaited<ReturnType<typeof buildApp>>,
  address = 1;
function client() {
  const jar = new Map<string, string>();
  let csrf = '';
  const ip = '127.0.23.' + address++;
  return {
    async call(method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, payload?: unknown) {
      if (method !== 'GET' || !csrf) {
        const r = await server.inject({ url: '/v1/security/csrf', remoteAddress: ip });
        csrf = r.json().token;
        const set = String(r.headers['set-cookie']).split(';')[0]!;
        jar.set(set.split('=')[0]!, set);
      }
      const r = await server.inject({
        method,
        url,
        remoteAddress: ip,
        headers: { cookie: [...jar.values()].join('; '), 'x-csrf-token': csrf },
        ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
      });
      const set = r.headers['set-cookie'];
      for (const v of set ? (Array.isArray(set) ? set : [set]) : []) {
        const pair = v.split(';')[0]!;
        jar.set(pair.split('=')[0]!, pair);
      }
      return r;
    },
  };
}
async function coach(label: string) {
  const http = client();
  const r = await http.call('POST', '/v1/auth/register-coach', {
    fullName: 'Coach QA',
    email: label + randomUUID() + '@example.test',
    password: 'Synthetic-monthly-2026!',
    name: 'Coach ' + label,
    slug: 'manual-' + randomUUID().slice(0, 8),
    kind: 'coach',
    accent: '#005ea8',
    plan: 'basic',
    privacyAccepted: true,
  });
  expect(r.statusCode, r.body).toBe(201);
  const userId = (await http.call('GET', '/v1/auth/me')).json().user.id;
  await admin.query('UPDATE app_users SET email_verified_at=now() WHERE id=$1', [userId]);
  return { http, id: r.json().organizationId as string, userId };
}
type Coach = Awaited<ReturnType<typeof coach>>;
let a: Coach,
  b: Coach,
  operator: ReturnType<typeof client>,
  operatorId: string,
  pupil: ReturnType<typeof client>,
  studentId: string;
const month = '2026-10',
  next = '2026-11';
const root = () => `/v1/organizations/${a.id}`;
async function info() {
  return (await a.http.call('GET', root() + '/monthly-control?month=' + month)).json().control;
}
async function settings(
  enabled: boolean,
  limit: number,
  revision?: number,
  requestId = randomUUID(),
) {
  const current = await info();
  return operator.call('PUT', `/v1/admin/organizations/${a.id}/manual-control`, {
    accessEnabled: enabled,
    studentLimit: limit,
    monthlyPricePyg: 125000,
    revision: revision ?? current.revision,
    requestId,
    reason: 'Control manual aprobado en prueba',
  });
}
async function student() {
  const created = await a.http.call('POST', root() + '/students', {
    displayName: 'Alumno QA',
    email: 'pupil-' + randomUUID() + '@example.test',
    goal: '',
  });
  expect(created.statusCode, created.body).toBe(201);
  const s = created.json().student;
  const invite = (await a.http.call('POST', root() + `/students/${s.id}/invitation`)).json();
  const http = client();
  const accepted = await http.call('POST', '/v1/invitations/accept', {
    token: new URL(invite.url).searchParams.get('token'),
    fullName: 'Alumno QA',
    goal: '',
    password: 'Synthetic-pupil-2026!',
    privacyAccepted: true,
  });
  return { http, id: s.id as string, response: accepted };
}
beforeAll(async () => {
  const storage = await fixture.create();
  server = await buildApp({
    origin: 'http://127.0.0.1:5173',
    cookieSecret: 'monthly-only-local-cookie-secret-long-enough',
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    storageRoot: storage,
  });
  a = await coach('A');
  b = await coach('B');
  operator = client();
  operatorId = randomUUID();
  const email = 'operator-' + randomUUID() + '@example.test';
  await admin.query(
    "INSERT INTO app_users(id,email,password_hash,full_name,is_superadmin,email_verified_at) SELECT $1,$2,password_hash,'Admin QA',true,now() FROM app_users WHERE id=$3",
    [operatorId, email, a.userId],
  );
  expect(
    (await operator.call('POST', '/v1/auth/login', { email, password: 'Synthetic-monthly-2026!' }))
      .statusCode,
  ).toBe(200);
}, 30000);
afterAll(async () => {
  await server?.close();
  await sql.end();
  await admin.end();
  await fixture.drop();
});
it('requires manual approval and lets only operator set monthly price, cap and access with revisions', async () => {
  expect(await info()).toMatchObject({
    manualMode: true,
    status: 'suspended',
    studentLimit: 0,
    monthlyPricePyg: null,
  });
  expect((await a.http.call('GET', root() + '/coach-start')).statusCode).toBe(403);
  const path = `/v1/admin/organizations/${a.id}/manual-control`,
    body = {
      studentLimit: 1,
      monthlyPricePyg: 125000,
      accessEnabled: true,
      revision: (await info()).revision,
      requestId: randomUUID(),
      reason: 'Configuración mensual de prueba',
    };
  expect((await a.http.call('PUT', path, body)).statusCode).toBe(403);
  const r = await operator.call('PUT', path, body);
  expect(r.statusCode, r.body).toBe(200);
  expect((await operator.call('PUT', path, body)).json()).toEqual(r.json());
  expect(await info()).toMatchObject({
    status: 'active',
    studentLimit: 1,
    monthlyPricePyg: 125000,
  });
  await admin.query(
    "UPDATE saas_subscriptions SET trial_ends_at=now()-interval '2 years' WHERE organization_id=$1",
    [a.id],
  );
  expect((await a.http.call('GET', root() + '/subscription')).json().subscription).toMatchObject({
    status: 'active',
    manualMode: true,
    studentLimit: 1,
  });
  expect((await operator.call('PUT', path, { ...body, requestId: randomUUID() })).json().code).toBe(
    'STALE_MANUAL_CONTROL',
  );
  expect((await b.http.call('GET', root() + '/monthly-control?month=' + month)).statusCode).toBe(
    404,
  );
});
it('enforces the configured cap on invitation acceptance and reactivation', async () => {
  const first = await student();
  expect(first.response.statusCode, first.response.body).toBe(200);
  pupil = first.http;
  studentId = first.id;
  const second = await student();
  expect(second.response.json().code).toBe('STUDENT_LIMIT');
  expect((await settings(true, 0)).json().code).toBe('MANUAL_CAPACITY');
  const list = await a.http.call('GET', root() + '/monthly-students?month=' + month);
  expect(list.statusCode, list.body).toBe(200);
  expect(list.json().students.find((s: { id: string }) => s.id === studentId)).toMatchObject({
    status: 'active',
    paid: false,
    paymentRevision: 0,
  });
});
it('records monthly marks with replay, correction and isolation without changing pupil access', async () => {
  const path = root() + `/students/${studentId}/monthly-payment`,
    body = {
      month,
      paid: true,
      revision: 0,
      requestId: randomUUID(),
      reason: 'Pago externo confirmado por coach',
    };
  const r = await a.http.call('PUT', path, body);
  expect(r.statusCode, r.body).toBe(200);
  expect((await a.http.call('PUT', path, body)).json()).toEqual(r.json());
  expect((await a.http.call('PUT', path, { ...body, paid: false })).json().code).toBe(
    'MANUAL_INTENTION_CONFLICT',
  );
  expect((await b.http.call('PUT', path, body)).statusCode).toBe(404);
  expect((await pupil.call('PUT', path, body)).statusCode).toBe(403);
  expect((await operator.call('PUT', path, body)).statusCode).toBe(404);
  expect(
    (await a.http.call('PUT', path, { ...body, paid: false, revision: 1, requestId: randomUUID() }))
      .statusCode,
  ).toBe(200);
  expect(
    (await a.http.call('GET', root() + '/monthly-students?month=' + next))
      .json()
      .students.find((s: { id: string }) => s.id === studentId),
  ).toMatchObject({ paid: false, paymentRevision: 0, status: 'active' });
  expect((await pupil.call('GET', root() + '/portal')).statusCode).toBe(200);
  await expect(
    admin.query(
      "UPDATE manual_monthly_events SET reason='Alteración inválida' WHERE organization_id=$1",
      [a.id],
    ),
  ).rejects.toThrow('MANUAL_HISTORY_IMMUTABLE');
});
it('keeps payment separate from coach access and restores only individually active pupils', async () => {
  const current = await info();
  expect((await settings(false, 1)).statusCode).toBe(200);
  expect((await pupil.call('GET', root() + '/portal')).statusCode).toBe(403);
  const mark = {
    month,
    paid: true,
    revision: 0,
    requestId: randomUUID(),
    reason: 'Pago del coach comprobado externamente',
  };
  expect(
    (await operator.call('PUT', `/v1/admin/organizations/${a.id}/monthly-payment`, mark))
      .statusCode,
  ).toBe(200);
  expect(await info()).toMatchObject({ paid: true, status: 'suspended' });
  expect(
    (await a.http.call('PUT', `/v1/admin/organizations/${a.id}/monthly-payment`, mark)).statusCode,
  ).toBe(403);
  expect((await settings(true, 1, current.revision)).json().code).toBe('STALE_MANUAL_CONTROL');
  expect((await settings(true, 1)).statusCode).toBe(200);
  const s = (await a.http.call('GET', root() + '/monthly-students?month=' + month))
    .json()
    .students.find((s: { id: string }) => s.id === studentId);
  expect(
    (
      await a.http.call('PATCH', root() + `/students/${studentId}/state`, {
        status: 'paused',
        version: s.version,
        reason: 'Decisión manual mensual',
      })
    ).statusCode,
  ).toBe(200);
  expect((await settings(false, 1)).statusCode).toBe(200);
  expect((await settings(true, 1)).statusCode).toBe(200);
  expect((await pupil.call('GET', root() + '/portal')).statusCode).toBe(403);
  expect(
    (await a.http.call('GET', root() + '/monthly-control?month=' + next)).json().control,
  ).toMatchObject({ paid: false, paymentRevision: 0, status: 'active' });
});
it('protects marks and settings at SQL boundary and preserves audit/countable state', async () => {
  await admin.query(
    'INSERT INTO monthly_payment_marks(organization_id,month,paid,revision,updated_by)VALUES($1,$2,false,1,$3) ON CONFLICT DO NOTHING',
    [a.id, month + '-01', operatorId],
  );
  const own = await actorTransaction(sql, a.userId, a.id, (db) =>
    db.query(
      'SELECT id FROM monthly_payment_marks WHERE organization_id=$1 AND student_id IS NULL',
      [a.id],
    ),
  );
  expect(own.rowCount).toBe(1);
  await expect(
    actorTransaction(sql, a.userId, a.id, (db) =>
      db.query('SELECT app.manual_configure($1,9,0,true,0,$2,$3)', [
        a.id,
        randomUUID(),
        'Intento sin permiso',
      ]),
    ),
  ).rejects.toMatchObject({ message: 'FORBIDDEN' });
  const visible = await actorTransaction(sql, b.userId, b.id, (db) =>
    db.query('SELECT id FROM monthly_payment_marks WHERE organization_id=$1', [a.id]),
  );
  expect(visible.rowCount).toBe(0);
  await admin.query("UPDATE app_users SET status='disabled' WHERE id=$1", [a.userId]);
  try {
    const disabled = await actorTransaction(sql, a.userId, a.id, (db) =>
      db.query('SELECT id FROM monthly_payment_marks WHERE organization_id=$1', [a.id]),
    );
    expect(disabled.rowCount).toBe(0);
  } finally {
    await admin.query("UPDATE app_users SET status='active' WHERE id=$1", [a.userId]);
  }
  expect((await operator.call('GET', '/v1/admin/monthly-coaches?month=' + month)).statusCode).toBe(
    200,
  );
  expect((await a.http.call('GET', '/v1/admin/monthly-coaches?month=' + month)).statusCode).toBe(
    403,
  );
});
