import { approveFixtureCoach } from '../helpers/coach-approval.js';
import 'dotenv/config';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { buildApp } from '../../apps/api/src/app.js';
import { actorTransaction } from '../../apps/api/src/organizations.js';
import { isolatedDatabase } from '../helpers/database.js';
import { monthlyAmount } from '@forma/shared';
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
  await approveFixtureCoach(admin, r.json().organizationId, { legacy: true });
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
  return { id, http, userId: (await http.call('GET', '/v1/auth/me')).json().user.id };
}

let a: Coach,
  b: Coach,
  s1: Awaited<ReturnType<typeof pupil>>,
  s2: Awaited<ReturnType<typeof pupil>>,
  root: string,
  invoiceId: string;
beforeAll(async () => {
  directory = await fixture.create();
  server = await buildApp({
    origin: 'http://127.0.0.1:5173',
    cookieSecret: 'billing-tests-secret-at-least-32-characters',
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    storageRoot: directory,
    developmentMailbox: true,
  });
  a = await coach('billing');
  b = await coach('platform');
  await admin.query('UPDATE app_users SET is_superadmin=true WHERE id=$1', [b.userId]);
  s1 = await pupil(a, 'Alumna Cuenta');
  s2 = await pupil(a, 'Otro Alumno Cuenta');
  root = `/v1/organizations/${a.id}/billing`;
}, 40000);
afterAll(async () => {
  await server?.close();
  await api.end();
  await worker.end();
  await admin.end();
  await fixture.drop();
});
describe('T07 monthly account', () => {
  it('requires explicit enablement, rejects cross-tenant and ordinary coach writes', async () => {
    const q = root + '/preview?month=2026-09';
    await actorTransaction(api, a.userId, a.id, (db) =>
      db.query("SELECT app.billing_preview($1,'2026-09-01')", [a.id]),
    );
    expect((await a.http.call('GET', q)).json().preview.lines).toEqual([]);
    expect(
      (await a.http.call('POST', root + '/enable', { reason: 'Acuerdo ficticio para pruebas' }))
        .statusCode,
    ).toBe(403);
    const enabled = await b.http.call('POST', root + '/enable', {
      reason: 'Acuerdo ficticio para pruebas',
    });
    expect(enabled.statusCode, enabled.body).toBe(200);
    expect((await b.http.call('POST', root + '/issue', { month: '2026-09' })).json().code).toBe(
      'BILLING_NOT_ENABLED',
    );
    expect((await s1.http.call('GET', q)).statusCode).toBe(404);
    expect(
      (await a.http.call('GET', `/v1/organizations/${b.id}/billing/preview?month=2026-09`))
        .statusCode,
    ).toBe(404);
  });
  it('calculates distinct touched days and correct half-open boundaries with a frozen opening plan', async () => {
    // All backdating below is isolated synthetic fixture setup, never a public API capability.
    await admin.query('DELETE FROM student_billable_intervals WHERE organization_id=$1', [a.id]);
    // Enrollment is immutable: fixture replaces only the newly created isolated database row using TRUNCATE, before any invoice exists.
    await admin.query('TRUNCATE saas_billing_enrollments');
    await admin.query(
      "INSERT INTO saas_billing_enrollments(organization_id,started_at,initial_plan_version_id,created_by,reason)VALUES($1,'2024-01-01T03:00:00Z','52000000-0000-4000-8000-000000000001',$2,'Fixture histórico sintético')",
      [a.id, b.userId],
    );
    await admin.query(
      "UPDATE saas_subscriptions SET trial_ends_at='2024-01-15T03:00:00Z' WHERE organization_id=$1",
      [a.id],
    );
    for (const [student, lo, hi] of [
      [s1.id, '2026-09-01T03:00:00Z', '2026-09-16T03:00:00Z'],
      [s1.id, '2026-09-16T12:00:00Z', '2026-09-16T13:00:00Z'],
      [s1.id, '2026-09-16T14:00:00Z', '2026-09-17T03:00:00Z'],
      [s2.id, '2026-09-30T23:59:59-03:00', '2026-10-01T00:00:00-03:00'],
    ])
      await admin.query(
        'INSERT INTO student_billable_intervals(organization_id,student_id,opened_at,closed_at)VALUES($1,$2,$3,$4)',
        [a.id, student, lo, hi],
      );
    await admin.query(
      "INSERT INTO saas_subscription_events(organization_id,actor_user_id,previous_plan_version_id,new_plan_version_id,reason,created_at)VALUES($1,$2,'52000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000002','Cambio sintético en mitad de mes','2026-09-15T15:00:00Z')",
      [a.id, b.userId],
    );
    await admin.query(
      "UPDATE saas_subscriptions SET plan_version_id='52000000-0000-4000-8000-000000000002' WHERE organization_id=$1",
      [a.id],
    );
    const r = await a.http.call('GET', root + '/preview?month=2026-09');
    expect(r.statusCode, r.body).toBe(200);
    const p = r.json().preview;
    expect(p.plan.pricePyg).toBe(10000);
    expect(p.lines.find((l: { studentId: string }) => l.studentId === s1.id)).toMatchObject({
      days: 16,
      amountPyg: 5333,
    });
    expect(p.lines.find((l: { studentId: string }) => l.studentId === s2.id)).toMatchObject({
      days: 1,
      amountPyg: 333,
    });
    expect(p.totalPyg).toBe(5666);
    expect(
      (await a.http.call('GET', root + '/preview?month=2026-10')).json().preview.plan.pricePyg,
    ).toBe(15000);
  });
  it('handles months of 28/29/30/31 days, trial cutoff and timezone consistently', async () => {
    for (const month of ['2025-02', '2024-02', '2026-04', '2026-07']) {
      const lo = month + '-01T00:00:00-03:00',
        hi = month + '-02T00:00:00-03:00';
      await admin.query(
        'INSERT INTO student_billable_intervals(organization_id,student_id,opened_at,closed_at)VALUES($1,$2,$3,$4)',
        [a.id, s1.id, lo, hi],
      );
      const p = (await a.http.call('GET', root + '/preview?month=' + month)).json().preview;
      expect(p.totalPyg).toBe(monthlyAmount(10000, 1, p.daysInMonth));
    }
    const normal = (await a.http.call('GET', root + '/preview?month=2026-09')).json().preview;
    const changed = await actorTransaction(api, a.userId, a.id, async (db) => {
      await db.query("SET LOCAL TIME ZONE 'Pacific/Kiritimati'");
      return (await db.query("SELECT app.billing_preview($1,'2026-09-01') data", [a.id])).rows[0]
        .data;
    });
    expect(changed.lines).toEqual(normal.lines);
    expect(changed.totalPyg).toBe(5666);
  });
  it('issues one immutable account under concurrency and preserves its student/plan snapshot', async () => {
    const rs = await Promise.all([
      b.http.call('POST', root + '/issue', { month: '2026-09' }),
      b.http.call('POST', root + '/issue', { month: '2026-09' }),
    ]);
    for (const r of rs) expect(r.statusCode, r.body).toBe(200);
    invoiceId = rs[0]!.json().invoice.id;
    expect(rs[1]!.json().invoice.id).toBe(invoiceId);
    await expect(
      admin.query('UPDATE saas_invoices SET total_pyg=0 WHERE id=$1', [invoiceId]),
    ).rejects.toThrow('IMMUTABLE_BILLING');
    await admin.query("UPDATE students SET display_name='Nombre actualizado' WHERE id=$1", [s1.id]);
    const p = (await a.http.call('GET', root + '/preview?month=2026-09')).json().preview;
    expect(p.totalPyg).toBe(5666);
    expect(p.lines.some((l: { name: string }) => l.name === 'Alumna Cuenta')).toBe(true);
    expect(p.issuedId).toBe(invoiceId);
    expect((await b.http.call('POST', root + '/issue', { month: '2026-10' })).json().code).toBe(
      'BILLING_PERIOD_OPEN',
    );
  });
  it('records idempotent adjustments, partial payments and immutable reversals without overpayment', async () => {
    const path = root + `/invoices/${invoiceId}`,
      adj = { requestId: randomUUID(), amountPyg: -666, reason: 'Abono ficticio justificado' };
    expect((await a.http.call('POST', path + '/adjustments', adj)).statusCode).toBe(403);
    expect((await b.http.call('POST', path + '/adjustments', adj)).json().invoice.balancePyg).toBe(
      5000,
    );
    expect(
      (await b.http.call('POST', path + '/adjustments', adj)).json().invoice.adjustments,
    ).toHaveLength(1);
    expect(
      (await b.http.call('POST', path + '/adjustments', { ...adj, amountPyg: -700 })).json().code,
    ).toBe('IDEMPOTENCY_CONFLICT');
    const pay = {
      requestId: randomUUID(),
      amountPyg: 3000,
      reference: 'Transferencia ficticia',
      paidOn: '2026-10-01',
    };
    const r = await b.http.call('POST', path + '/payments', pay);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().invoice).toMatchObject({ balancePyg: 2000, paidPyg: 3000, status: 'partial' });
    expect(
      (await b.http.call('POST', path + '/payments', pay)).json().invoice.payments,
    ).toHaveLength(1);
    expect(
      (await b.http.call('POST', path + '/payments', { ...pay, requestId: randomUUID() })).json()
        .code,
    ).toBe('BILLING_OVERPAYMENT');
    for (const amountPyg of [null, '100', 1.5])
      expect(
        (
          await b.http.call('POST', path + '/payments', {
            ...pay,
            requestId: randomUUID(),
            amountPyg,
          })
        ).statusCode,
      ).toBe(400);
    const id = r.json().invoice.payments[0].id,
      reverse = { requestId: randomUUID(), reason: 'Reversión ficticia del registro' };
    expect((await b.http.call('POST', root + `/payments/${id}/reverse`, reverse)).statusCode).toBe(
      200,
    );
    expect((await b.http.call('POST', root + `/payments/${id}/reverse`, reverse)).statusCode).toBe(
      200,
    );
    expect((await a.http.call('GET', path)).json().invoice.balancePyg).toBe(5000);
  });
  it('keeps receipts private, includes them in backup references and cleans duplicate uploads', async () => {
    const bytes = await sharp({
        create: { width: 80, height: 100, channels: 3, background: '#336699' },
      })
        .png()
        .toBuffer(),
      body = {
        requestId: randomUUID(),
        amountPyg: 5000,
        reference: 'Comprobante sintético',
        paidOn: '2026-10-01',
        receiptDataUrl: 'data:image/png;base64,' + bytes.toString('base64'),
      },
      path = root + `/invoices/${invoiceId}/payments`;
    const rs = await Promise.all([
      b.http.call('POST', path, body),
      b.http.call('POST', path, body),
    ]);
    for (const r of rs) expect(r.statusCode, r.body).toBe(200);
    expect(rs[0]!.json().invoice).toMatchObject({
      paidPyg: 5000,
      balancePyg: 0,
      status: 'settled',
    });
    const p = rs[0]!
        .json()
        .invoice.payments.find((p: { receiptUrl: string | null }) => p.receiptUrl),
      url = p.receiptUrl;
    expect((await a.http.call('GET', url)).statusCode).toBe(200);
    expect((await s1.http.call('GET', url)).statusCode).toBe(404);
    const result = await a.http.call('GET', url);
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect((await sharp(result.rawPayload).metadata()).exif).toBeUndefined();
    const key = (await admin.query('SELECT receipt_key FROM saas_payments WHERE id=$1', [p.id]))
      .rows[0].receipt_key;
    expect(
      (await worker.query('SELECT app.media_storage_references() key')).rows.map((r) => r.key),
    ).toContain(key);
  });
  it('excludes pre-trial days, serializes independent payments and restricts pilot aggregates', async () => {
    await admin.query(
      "INSERT INTO student_billable_intervals(organization_id,student_id,opened_at,closed_at)VALUES($1,$2,'2024-01-01T00:00:00-03:00','2024-02-01T00:00:00-03:00')",
      [a.id, s1.id],
    );
    const trial = (await a.http.call('GET', root + '/preview?month=2024-01')).json().preview;
    expect(trial.lines[0].days).toBe(17);
    expect(trial.totalPyg).toBe(5484);
    const r = await b.http.call('POST', root + '/issue', { month: '2026-04' });
    expect(r.statusCode, r.body).toBe(200);
    const id = r.json().invoice.id;
    const rs = await Promise.all(
      [1, 2].map(() =>
        b.http.call('POST', root + `/invoices/${id}/payments`, {
          requestId: randomUUID(),
          amountPyg: 300,
          reference: 'Pago concurrente ficticio',
          paidOn: '2026-10-01',
        }),
      ),
    );
    expect(rs.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect((await a.http.call('GET', root + `/invoices/${id}`)).json().invoice.balancePyg).toBe(33);
    expect((await a.http.call('GET', '/v1/admin/pilot-summary')).statusCode).toBe(403);
    const aggregate = await b.http.call('GET', '/v1/admin/pilot-summary');
    expect(aggregate.statusCode, aggregate.body).toBe(200);
    expect(aggregate.json().summary).toMatchObject({ issuedAccounts: 2, outstandingPyg: 33 });
    expect(JSON.stringify(aggregate.json())).not.toContain('studentId');
  });
  it('serves independent public brand manifests and PNG icons without private fields', async () => {
    const brand = (
      await a.http.call(
        'GET',
        `/v1/public/studios/${(await a.http.call('GET', '/v1/organizations')).json().organizations[0].slug}`,
      )
    ).json().brand;
    const path = `/v1/public/studios/${brand.slug}`;
    const m = await client().call('GET', path + '/manifest.webmanifest');
    expect(m.statusCode, m.body).toBe(200);
    expect(m.json()).toMatchObject({
      id: `/app-id/${a.id}`,
      name: brand.name,
      start_url: `/abrir/${brand.slug}`,
      scope: '/',
      display: 'standalone',
    });
    expect(JSON.stringify(m.json())).not.toMatch(/student|token|password/);
    for (const size of [180, 192, 512]) {
      const icon = await client().call('GET', path + '/app-icon.png?size=' + size);
      expect(icon.statusCode, icon.body).toBe(200);
      const metadata = await sharp(icon.rawPayload).metadata();
      expect(metadata).toMatchObject({ format: 'png', width: size, height: size });
    }
    const other = (await b.http.call('GET', '/v1/organizations')).json().organizations[0];
    expect(
      (await client().call('GET', `/v1/public/studios/${other.slug}/manifest.webmanifest`)).json()
        .id,
    ).not.toBe(m.json().id);
  });
  it('denies financial access to assigned staff and preserves owner account access during suspension', async () => {
    const staff = await coach('billing-staff');
    await admin.query(
      "INSERT INTO organization_memberships(organization_id,user_id,role)VALUES($1,$2,'coach')",
      [a.id, staff.userId],
    );
    await admin.query('INSERT INTO student_professionals VALUES($1,$2,$3)', [
      a.id,
      s1.id,
      staff.userId,
    ]);
    expect((await staff.http.call('GET', root + '/invoices')).statusCode).toBe(404);
    expect(
      (
        await actorTransaction(api, staff.userId, a.id, (db) =>
          db.query('SELECT id FROM saas_invoices'),
        )
      ).rows,
    ).toEqual([]);
    const suspended = await b.http.call('PATCH', `/v1/admin/organizations/${a.id}/state`, {
      status: 'suspended',
      reason: 'Suspensión sintética controlada',
    });
    expect(suspended.statusCode, suspended.body).toBe(200);
    expect(
      (await a.http.call('GET', root + `/invoices/${invoiceId}`)).json().invoice.balancePyg,
    ).toBe(0);
    expect((await a.http.call('GET', `/v1/organizations/${a.id}/workouts`)).statusCode).toBe(403);
    expect(
      (
        await b.http.call('PATCH', `/v1/admin/organizations/${a.id}/state`, {
          status: 'resume',
          reason: 'Fin de suspensión sintética',
        })
      ).statusCode,
    ).toBe(200);
  });
  it('activates an expired subscription atomically without retroactive fees or duplicate enrollment', async () => {
    const expired = await coach('expired'),
      base = `/v1/organizations/${expired.id}`;
    await admin.query(
      "UPDATE saas_subscriptions SET trial_ends_at=now()-interval '1 day' WHERE organization_id=$1",
      [expired.id],
    );
    const body = { kind: 'image', bytes: 100, requestId: randomUUID() };
    expect((await expired.http.call('POST', base + '/media/uploads', body)).json().code).toBe(
      'SUBSCRIPTION_INACTIVE',
    );
    const enabled = await b.http.call('POST', base + '/billing/enable', {
      reason: 'Acuerdo sintético tras finalizar prueba',
    });
    expect(enabled.statusCode, enabled.body).toBe(200);
    expect(
      (await expired.http.call('GET', base + '/subscription')).json().subscription.status,
    ).toBe('active');
    expect((await expired.http.call('POST', base + '/media/uploads', body)).statusCode).toBe(201);
    const first = (
      await admin.query(
        'SELECT started_at FROM saas_billing_enrollments WHERE organization_id=$1',
        [expired.id],
      )
    ).rows[0].started_at;
    await b.http.call('POST', base + '/billing/enable', {
      reason: 'Reintento del mismo acuerdo sintético',
    });
    expect(
      (
        await admin.query(
          'SELECT started_at FROM saas_billing_enrollments WHERE organization_id=$1',
          [expired.id],
        )
      ).rows,
    ).toEqual([{ started_at: first }]);
    expect(
      (await b.http.call('POST', base + '/billing/issue', { month: '2026-09' })).json().code,
    ).toBe('BILLING_NOT_ENABLED');
  });
});
