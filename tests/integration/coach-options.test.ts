import 'dotenv/config';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import pg from 'pg';
import { buildApp } from '../../apps/api/src/app.js';
import { actorTransaction } from '../../apps/api/src/organizations.js';
import { isolatedDatabase } from '../helpers/database.js';
import { approveFixtureCoach } from '../helpers/coach-approval.js';
import { freshSet } from '@forma/shared';
const fixture = isolatedDatabase();
const admin = new pg.Pool({
  connectionString: fixture.url(process.env.DATABASE_ADMIN_URL),
  max: 1,
});
const sql = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_URL), max: 1 });
let server: Awaited<ReturnType<typeof buildApp>>, storage: string;
function client() {
  const jar = new Map<string, string>();
  return {
    async call(method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) {
      const csrf = await server.inject({ url: '/v1/security/csrf' });
      const cookie = String(csrf.headers['set-cookie']).split(';')[0]!;
      jar.set(cookie.split('=')[0]!, cookie);
      const response = await server.inject({
        method,
        url,
        headers: { cookie: [...jar.values()].join('; '), 'x-csrf-token': csrf.json().token },
        ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
      });
      for (const item of response.headers['set-cookie']
        ? [response.headers['set-cookie']].flat()
        : []) {
        const pair = item.split(';')[0]!;
        jar.set(pair.split('=')[0]!, pair);
      }
      return response;
    },
  };
}
async function coach(label: string) {
  const http = client();
  const r = await http.call('POST', '/v1/auth/register-coach', {
    fullName: 'Coach sintético',
    email: label + randomUUID() + '@example.test',
    password: 'Synthetic-content-only-2026!',
    name: 'Coach ' + label,
    slug: 'content-' + randomUUID().slice(0, 8),
    kind: 'coach',
    accent: '#005ea8',
    plan: 'basic',
    privacyAccepted: true,
  });
  expect(r.statusCode, r.body).toBe(201);
  const id = r.json().organizationId as string;
  await approveFixtureCoach(admin, id);
  return {
    http,
    id,
    userId: (await http.call('GET', '/v1/auth/me')).json().user.id as string,
    root: '/v1/organizations/' + id,
  };
}
let a: Awaited<ReturnType<typeof coach>>, b: Awaited<ReturnType<typeof coach>>;
beforeAll(async () => {
  storage = await fixture.create();
  server = await buildApp({
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    storageRoot: storage,
    origin: 'http://127.0.0.1:5173',
    cookieSecret: 'synthetic-content-cookie-longer-than-32',
  });
  a = await coach('A');
  b = await coach('B');
});
afterAll(async () => {
  await server?.close();
  await sql.end();
  await admin.end();
  await fixture.drop();
  if (
    storage &&
    dirname(resolve(storage)) === resolve('.local/test-storage') &&
    /^forma_test_[a-f0-9]{32}-/.test(basename(storage))
  )
    await rm(storage, { recursive: true });
});
it('starts empty, remembers the coach vocabulary idempotently and isolates API and SQL', async () => {
  const path = a.root + '/field-options';
  expect((await a.http.call('GET', path)).json().options).toEqual([]);
  const write = await a.http.call('POST', path, {
    field: 'student_goal',
    value: ' Mi objetivo propio ',
  });
  expect(write.statusCode, write.body).toBe(200);
  expect(write.json().option.value).toBe('Mi objetivo propio');
  const repeat = await a.http.call('POST', path, {
    field: 'student_goal',
    value: 'mi objetivo propio',
  });
  expect(repeat.json().option.id).toBe(write.json().option.id);
  expect((await a.http.call('GET', path)).json().options).toHaveLength(1);
  expect((await b.http.call('GET', b.root + '/field-options')).json().options).toEqual([]);
  expect((await b.http.call('GET', path)).statusCode).toBe(404);
  expect(
    (await b.http.call('POST', path, { field: 'student_goal', value: 'Ataque' })).statusCode,
  ).toBe(404);
  expect(
    (await a.http.call('POST', path, { field: 'student_goal', value: '   ' })).statusCode,
  ).toBe(400);
  const positive = await actorTransaction(sql, a.userId, a.id, (db) =>
    db.query('SELECT value FROM coach_field_options'),
  );
  expect(positive.rows).toHaveLength(1);
  const hidden = await actorTransaction(sql, b.userId, b.id, (db) =>
    db.query('SELECT value FROM coach_field_options'),
  );
  expect(hidden.rows).toEqual([]);
  await expect(
    actorTransaction(sql, a.userId, a.id, (db) =>
      db.query(
        "INSERT INTO coach_field_options(organization_id,field,value,created_by) VALUES($1,'student_goal','direct',$2)",
        [a.id, a.userId],
      ),
    ),
  ).rejects.toThrow();
  await admin.query("UPDATE app_users SET status='disabled' WHERE id=$1", [a.userId]);
  expect(
    (
      await actorTransaction(sql, a.userId, a.id, (db) =>
        db.query('SELECT id FROM coach_field_options'),
      )
    ).rows,
  ).toEqual([]);
  await admin.query("UPDATE app_users SET status='active' WHERE id=$1", [a.userId]);
});
it('accepts custom exercise content and freezes only the explicitly selected visual in new versions', async () => {
  const body = {
    name: 'Movimiento elegido por el coach',
    instructions: 'Instrucciones sintéticas redactadas por el coach de prueba.',
    muscle: 'Mi clasificación',
    equipmentTag: 'Mi material',
    metric: 'reps',
    variations: [],
    tags: [],
    state: 'published',
    equipmentId: null,
    mediaId: null,
    visualKey: 'bench',
  };
  const r = await a.http.call('POST', a.root + '/exercises', body);
  expect(r.statusCode, r.body).toBe(201);
  const e = r.json().exercise;
  expect(e).toMatchObject({ muscle: 'Mi clasificación', visualKey: 'bench' });
  expect((await b.http.call('GET', b.root + '/exercises/' + e.id)).statusCode).toBe(404);
  const document = {
    name: 'Rutina del coach',
    description: 'Solo prueba',
    isTemplate: false,
    weeks: [
      {
        id: randomUUID(),
        name: 'Semana propia',
        days: [
          {
            id: randomUUID(),
            name: 'Día propio',
            weekday: 1,
            notes: '',
            exercises: [
              {
                id: randomUUID(),
                exerciseId: e.id,
                notes: '',
                sets: [{ ...freshSet(), repsMin: 5, repsMax: 5, restSeconds: 0 }],
              },
            ],
          },
        ],
      },
    ],
  };
  const created = await a.http.call('POST', a.root + '/programs', { document });
  expect(created.statusCode, created.body).toBe(201);
  const program = created.json().program;
  const published = await a.http.call('POST', a.root + '/programs/' + program.id + '/publish', {
    revision: program.revision,
  });
  expect(published.statusCode, published.body).toBe(200);
  expect(published.json().version.snapshot.weeks[0].days[0].exercises[0].snapshot.visualKey).toBe(
    'bench',
  );
  const changed = await a.http.call('PUT', a.root + '/exercises/' + e.id, {
    ...body,
    visualKey: 'squat',
    version: e.version,
  });
  expect(changed.statusCode, changed.body).toBe(200);
  const frozen = await a.http.call(
    'GET',
    a.root + '/program-versions/' + published.json().version.id,
  );
  expect(frozen.json().version.snapshot.weeks[0].days[0].exercises[0].snapshot.visualKey).toBe(
    'bench',
  );
});
