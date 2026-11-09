import { approveFixtureCoach } from '../helpers/coach-approval.js';
import 'dotenv/config';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import pg from 'pg';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../../apps/api/src/app.js';
import { actorTransaction } from '../../apps/api/src/organizations.js';
import type { StudentRecord, OrganizationSummary } from '@forma/shared';
import { tokenDigest } from '../../apps/api/src/security.js';
import { isolatedDatabase } from '../helpers/database.js';

const fixture = isolatedDatabase();
const admin = new pg.Pool({
  connectionString: fixture.url(process.env.DATABASE_ADMIN_URL),
  max: 3,
});
const api = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_URL), max: 3 });
let server: Awaited<ReturnType<typeof buildApp>>;
let actorCount = 1;
function client() {
  let cookies = '';
  let csrf = '';
  const ip = `127.0.0.${actorCount++}`;
  return {
    async call(
      method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      url: string,
      body?: unknown,
      host?: string,
    ) {
      if (!csrf) {
        const result = await server.inject({ url: '/v1/security/csrf', remoteAddress: ip });
        csrf = result.json().token;
        cookies = String(result.headers['set-cookie']).split(';')[0]!;
      }
      const response = await server.inject({
        method,
        url,
        remoteAddress: ip,
        headers: { cookie: cookies, 'x-csrf-token': csrf, ...(host ? { host } : {}) },
        ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
      });
      const set = response.headers['set-cookie'];
      if (set) {
        const values = Array.isArray(set) ? set : [set];
        for (const value of values) {
          const pair = value.split(';')[0]!;
          const name = pair.split('=')[0];
          cookies = cookies
            .split('; ')
            .filter((x) => !x.startsWith(`${name}=`))
            .concat(pair)
            .join('; ');
        }
      }
      return response;
    },
  };
}
type Client = ReturnType<typeof client>;
async function coach(label: string) {
  const http = client();
  const suffix = randomUUID().slice(0, 8);
  const email = `${label}-${suffix}@example.test`;
  const slug = `${label}-${suffix}`;
  const registered = await http.call('POST', '/v1/auth/register-coach', {
    fullName: `Coach ${label}`,
    email,
    password: 'Test-password-2026!',
    name: `Studio ${label}`,
    slug,
    kind: 'coach',
    accent: '#005ea8',
    plan: 'basic',
    privacyAccepted: true,
  });
  expect(registered.statusCode, registered.body).toBe(201);
  await approveFixtureCoach(admin, registered.json().organizationId);
  const me = (await http.call('GET', '/v1/auth/me')).json().user;
  return {
    http,
    email,
    slug,
    id: registered.json().organizationId as string,
    userId: me.id as string,
  };
}
async function verify(http: Client) {
  const mail = await http.call('GET', '/v1/development/emails');
  const url = mail
    .json()
    .emails.find((item: { kind: string }) => item.kind === 'email.verification').url;
  const token = new URL(url).searchParams.get('token');
  expect((await http.call('POST', '/v1/auth/verify-email', { token })).statusCode).toBe(200);
}
async function student(owner: Awaited<ReturnType<typeof coach>>, email: string) {
  const response = await owner.http.call('POST', `/v1/organizations/${owner.id}/students`, {
    displayName: 'Alumno de prueba',
    email,
    goal: 'Ganar fuerza',
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json().student as StudentRecord;
}
async function invitation(owner: Awaited<ReturnType<typeof coach>>, id: string) {
  const response = await owner.http.call(
    'POST',
    `/v1/organizations/${owner.id}/students/${id}/invitation`,
  );
  expect(response.statusCode, response.body).toBe(200);
  return new URL(response.json().url).searchParams.get('token')!;
}
async function accept(http: Client, token: string, password = 'Student-password-2026!') {
  return http.call('POST', '/v1/invitations/accept', {
    token,
    fullName: 'Alumno autenticado',
    goal: 'Bienestar',
    password,
    privacyAccepted: true,
  });
}
let a: Awaited<ReturnType<typeof coach>>,
  b: Awaited<ReturnType<typeof coach>>,
  platform: Awaited<ReturnType<typeof coach>>;
beforeAll(async () => {
  const storageRoot = await fixture.create();
  server = await buildApp({
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    storageRoot,
    origin: 'http://127.0.0.1:5173',
    cookieSecret: 'organizations-test-cookie-secret-at-least-32',
    developmentMailbox: true,
    tenantBaseDomain: 'studios.test',
  });
  a = await coach('alpha');
  b = await coach('beta');
  platform = await coach('platform');
  await verify(a.http);
  await verify(b.http);
  await admin.query('UPDATE app_users SET is_superadmin=true WHERE id=$1', [platform.userId]);
});
afterAll(async () => {
  if (server) await server.close();
  await api.end();
  await admin.end();
  await fixture.drop();
});
describe('T02 organizations and access', () => {
  it('registers an explicitly approved independent coach and rejects privilege escalation', async () => {
    const list = (await a.http.call('GET', '/v1/organizations')).json()
      .organizations as OrganizationSummary[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: a.id, role: 'owner', status: 'active' });
    const plan = (await a.http.call('GET', `/v1/organizations/${a.id}/subscription`)).json()
      .subscription;
    expect(plan).toMatchObject({
      planCode: 'basic',
      perStudentPricePyg: 10000,
      enabledStudents: 0,
      studentLimit: 25,
    });
    const forged = await client().call('POST', '/v1/auth/register-coach', {
      fullName: 'Fake owner',
      email: 'forged@example.test',
      password: 'Fake-password-2026!',
      name: 'Fake Studio',
      slug: 'forged-studio',
      kind: 'coach',
      accent: '#005ea8',
      plan: 'basic',
      privacyAccepted: true,
      isSuperadmin: true,
    });
    expect(forged.statusCode).toBe(400);
    await expect(
      api.query('UPDATE app_users SET is_superadmin=true WHERE id=$1', [a.userId]),
    ).rejects.toThrow();
  });
  it('isolates branding, students, raw SQL and domain context', async () => {
    const learner = await student(a, `isolation-${randomUUID()}@example.test`);
    expect((await b.http.call('GET', `/v1/organizations/${a.id}/students`)).statusCode).toBe(404);
    expect(
      (await b.http.call('GET', `/v1/organizations/${b.id}/students/${learner.id}`)).statusCode,
    ).toBe(404);
    const hidden = await actorTransaction(
      api,
      b.userId,
      a.id,
      async (db) => (await db.query('SELECT id FROM students')).rows,
    );
    expect(hidden).toEqual([]);
    expect(
      (await a.http.call('GET', `/v1/organizations/${a.id}`, undefined, `${b.slug}.studios.test`))
        .statusCode,
    ).toBe(404);
    expect(
      (await a.http.call('GET', `/v1/organizations/${a.id}`, undefined, `${a.slug}.studios.test`))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await b.http.call('PUT', `/v1/organizations/${a.id}/branding`, {
          name: 'Attack',
          accent: '#ffffff',
          welcomeMessage: 'x',
          biography: '',
          contactEmail: null,
        })
      ).statusCode,
    ).toBe(404);
  });
  it('persists a logo, keeps it intentionally public and prevents cross-organization media references', async () => {
    const image = await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#19e7d0' },
    })
      .png()
      .toBuffer();
    expect(
      (
        await a.http.call('POST', `/v1/organizations/${a.id}/branding/logo`, {
          dataUrl: `data:image/png;base64,${image.toString('base64')}`,
        })
      ).statusCode,
    ).toBe(200);
    const brand = (await client().call('GET', `/v1/public/studios/${a.slug}`)).json().brand;
    expect(brand.logoUrl).toContain('/logo');
    const logo = await client().call('GET', brand.logoUrl);
    expect(logo.headers['content-type']).toContain('image/webp');
    const asset = (
      await admin.query(
        'SELECT logo_asset_id FROM organization_branding WHERE organization_id=$1',
        [a.id],
      )
    ).rows[0].logo_asset_id;
    await expect(
      actorTransaction(api, b.userId, b.id, (db) =>
        db.query('UPDATE organization_branding SET logo_asset_id=$1 WHERE organization_id=$2', [
          asset,
          b.id,
        ]),
      ),
    ).rejects.toThrow();
    expect(
      (
        await a.http.call('POST', `/v1/organizations/${a.id}/branding/logo`, {
          dataUrl: 'data:image/png;base64,ZmFrZQ==',
        })
      ).statusCode,
    ).toBe(400);
    const disguisedSvg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
    );
    expect(
      (
        await a.http.call('POST', `/v1/organizations/${a.id}/branding/logo`, {
          dataUrl: `data:image/png;base64,${disguisedSvg.toString('base64')}`,
        })
      ).statusCode,
    ).toBe(400);
  });
  it('requires verified email and does not expose another account development mailbox', async () => {
    const learner = await student(platform, `unverified-${randomUUID()}@example.test`);
    expect(
      (
        await platform.http.call(
          'POST',
          `/v1/organizations/${platform.id}/students/${learner.id}/invitation`,
        )
      ).json().code,
    ).toBe('EMAIL_NOT_VERIFIED');
    const mailbox = (await b.http.call('GET', '/v1/development/emails')).json().emails as {
      url: string;
    }[];
    const token = (
      await admin.query('SELECT token_hash FROM email_verification_tokens WHERE user_id=$1', [
        a.userId,
      ])
    ).rows[0].token_hash;
    expect(
      mailbox.every((mail) => tokenDigest(new URL(mail.url).searchParams.get('token')!) !== token),
    ).toBe(true);
    expect((await client().call('GET', '/v1/development/emails')).statusCode).toBe(401);
  });
  it('accepts an invitation once, gates the student portal and updates billing intervals atomically', async () => {
    const learner = await student(a, `lifecycle-${randomUUID()}@example.test`);
    const token = await invitation(a, learner.id);
    const pupil = client();
    const inspected = await pupil.call('POST', '/v1/invitations/inspect', { token });
    expect(inspected.json().invitation.brand.slug).toBe(a.slug);
    expect((await accept(pupil, token)).statusCode).toBe(200);
    expect((await accept(client(), token)).statusCode).toBe(400);
    expect((await pupil.call('GET', `/v1/organizations/${a.id}/portal`)).json().student.id).toBe(
      learner.id,
    );
    expect((await pupil.call('GET', `/v1/organizations/${a.id}/students`)).statusCode).toBe(403);
    let row = (await a.http.call('GET', `/v1/organizations/${a.id}/students/${learner.id}`)).json()
      .student as StudentRecord;
    expect(row.status).toBe('active');
    const paused = await a.http.call(
      'PATCH',
      `/v1/organizations/${a.id}/students/${learner.id}/state`,
      { status: 'paused', version: row.version, reason: 'Pausa solicitada por el alumno' },
    );
    expect(paused.statusCode, paused.body).toBe(200);
    expect((await pupil.call('GET', `/v1/organizations/${a.id}/portal`)).json().code).toBe(
      'STUDENT_INACTIVE',
    );
    expect(
      (
        await admin.query(
          'SELECT count(*) FROM student_billable_intervals WHERE student_id=$1 AND closed_at IS NULL',
          [learner.id],
        )
      ).rows[0].count,
    ).toBe('0');
    row = paused.json().student;
    const requests = await Promise.all([
      a.http.call('PATCH', `/v1/organizations/${a.id}/students/${row.id}/state`, {
        status: 'active',
        version: row.version,
        reason: 'Reactivación acordada',
      }),
      a.http.call('PATCH', `/v1/organizations/${a.id}/students/${row.id}/state`, {
        status: 'active',
        version: row.version,
        reason: 'Reintento de activación',
      }),
    ]);
    expect(requests.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(
      (
        await admin.query(
          'SELECT count(*) FROM student_billable_intervals WHERE student_id=$1 AND closed_at IS NULL',
          [row.id],
        )
      ).rows[0].count,
    ).toBe('1');
  });
  it('invalidates previous invitations and rejects expired tokens', async () => {
    const learner = await student(b, `expired-${randomUUID()}@example.test`);
    const old = await invitation(b, learner.id);
    const current = await invitation(b, learner.id);
    expect(
      (await client().call('POST', '/v1/invitations/inspect', { token: old })).statusCode,
    ).toBe(400);
    await admin.query(
      "UPDATE invitation_links SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
      [tokenDigest(current)],
    );
    expect((await accept(client(), current)).statusCode).toBe(400);
    const latest = await invitation(b, learner.id);
    const archived = await b.http.call(
      'PATCH',
      `/v1/organizations/${b.id}/students/${learner.id}/state`,
      { status: 'archived', version: learner.version, reason: 'Archivo de invitación de prueba' },
    );
    expect(archived.statusCode).toBe(200);
    expect(
      (await client().call('POST', '/v1/invitations/inspect', { token: latest })).statusCode,
    ).toBe(400);
    expect(
      (
        await b.http.call('PATCH', `/v1/organizations/${b.id}/students/${learner.id}/state`, {
          status: 'invited',
          version: archived.json().student.version,
          reason: 'Reabrir ficha sin cuenta',
        })
      ).statusCode,
    ).toBe(200);
    expect((await accept(client(), await invitation(b, learner.id))).statusCode).toBe(200);
  });
  it('keeps one identity with two isolated student profiles and requires its existing password', async () => {
    const email = `shared-${randomUUID()}@example.test`;
    const one = await student(a, email),
      two = await student(b, email);
    const pupil = client();
    expect((await accept(pupil, await invitation(a, one.id))).statusCode).toBe(200);
    const token = await invitation(b, two.id);
    expect((await accept(client(), token, 'wrong-password')).statusCode).toBe(401);
    expect((await accept(pupil, token)).statusCode).toBe(200);
    const orgs = (await pupil.call('GET', '/v1/organizations')).json().organizations;
    expect(orgs.filter((o: OrganizationSummary) => o.role === 'student')).toHaveLength(2);
    const userId = (await pupil.call('GET', '/v1/auth/me')).json().user.id;
    expect(
      (await admin.query('SELECT count(*) FROM students WHERE user_id=$1', [userId])).rows[0].count,
    ).toBe('2');
  });
  it('counts one student for two professionals and restricts an unassigned coach', async () => {
    const email = `team-${randomUUID()}@example.test`;
    const learner = await student(a, email);
    const pupil = client();
    expect((await accept(pupil, await invitation(a, learner.id))).statusCode).toBe(200);
    await admin.query(
      "INSERT INTO organization_memberships(organization_id,user_id,role)VALUES($1,$2,'coach')",
      [a.id, b.userId],
    );
    expect(
      (await b.http.call('GET', `/v1/organizations/${a.id}/students/${learner.id}`)).statusCode,
    ).toBe(404);
    await admin.query(
      'INSERT INTO student_professionals(organization_id,student_id,professional_user_id)VALUES($1,$2,$3)',
      [a.id, learner.id, b.userId],
    );
    expect(
      (await b.http.call('GET', `/v1/organizations/${a.id}/students/${learner.id}`)).statusCode,
    ).toBe(200);
    expect(
      (
        await admin.query(
          'SELECT count(*) FROM student_billable_intervals WHERE student_id=$1 AND closed_at IS NULL',
          [learner.id],
        )
      ).rows[0].count,
    ).toBe('1');
  });
  it('enforces the plan seat limit under concurrent invitation acceptance', async () => {
    const owner = await coach('quota');
    await approveFixtureCoach(admin, owner.id, { limit: 1 });
    await verify(owner.http);
    const p = randomUUID(),
      v = randomUUID();
    await admin.query('INSERT INTO saas_plans(id,code,name)VALUES($1,$2,$3)', [
      p,
      `test-${p}`,
      'Test only',
    ]);
    await admin.query(
      'INSERT INTO saas_plan_versions(id,plan_id,version_no,per_student_price_pyg,student_limit)VALUES($1,$2,1,10000,1)',
      [v, p],
    );
    await admin.query('UPDATE saas_subscriptions SET plan_version_id=$1 WHERE organization_id=$2', [
      v,
      owner.id,
    ]);
    const s1 = await student(owner, `quota1-${p}@example.test`),
      s2 = await student(owner, `quota2-${p}@example.test`);
    const tokens = [await invitation(owner, s1.id), await invitation(owner, s2.id)];
    const responses = await Promise.all(tokens.map((token) => accept(client(), token)));
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      (
        await admin.query(
          "SELECT count(*) FROM students WHERE organization_id=$1 AND status='active'",
          [owner.id],
        )
      ).rows[0].count,
    ).toBe('1');
  });
  it('restricts superadmin access, suspends access and records platform actions', async () => {
    expect((await a.http.call('GET', '/v1/admin/organizations')).statusCode).toBe(403);
    const learner = await student(b, `suspend-${randomUUID()}@example.test`);
    const pupil = client();
    expect((await accept(pupil, await invitation(b, learner.id))).statusCode).toBe(200);
    const changed = await platform.http.call('PATCH', `/v1/admin/organizations/${b.id}/state`, {
      status: 'suspended',
      reason: 'Comprobación de suspensión de acceso',
    });
    expect(changed.statusCode, changed.body).toBe(200);
    expect((await b.http.call('GET', `/v1/organizations/${b.id}/students`)).json().code).toBe(
      'ORGANIZATION_SUSPENDED',
    );
    expect((await pupil.call('GET', `/v1/organizations/${b.id}/portal`)).statusCode).toBe(403);
    expect(
      (
        await admin.query(
          'SELECT count(*) FROM student_billable_intervals WHERE organization_id=$1 AND closed_at IS NULL',
          [b.id],
        )
      ).rows[0].count,
    ).toBe('0');
    expect(
      (
        await platform.http.call('PATCH', `/v1/admin/organizations/${b.id}/state`, {
          status: 'resume',
          reason: 'Acceso restablecido tras la comprobación',
        })
      ).statusCode,
    ).toBe(200);
    expect((await pupil.call('GET', `/v1/organizations/${b.id}/portal`)).statusCode).toBe(200);
    expect(
      (
        await platform.http.call('PATCH', `/v1/admin/organizations/${b.id}/plan`, {
          plan: 'pro',
          reason: 'Prueba de cambio a un plan superior',
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await b.http.call('GET', `/v1/organizations/${b.id}/subscription`)).json().subscription
        .planCode,
    ).toBe('pro');
    expect(
      Number(
        (
          await admin.query('SELECT count(*) FROM platform_audit_logs WHERE organization_id=$1', [
            b.id,
          ])
        ).rows[0].count,
      ),
    ).toBeGreaterThanOrEqual(3);
  });
});
