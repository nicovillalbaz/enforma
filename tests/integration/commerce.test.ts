import { approveFixtureCoach } from '../helpers/coach-approval.js';
import 'dotenv/config';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { buildApp } from '../../apps/api/src/app.js';
import { actorTransaction } from '../../apps/api/src/organizations.js';
import { isolatedDatabase } from '../helpers/database.js';
import { dateShift } from '@forma/shared';
const fixture = isolatedDatabase(),
  admin = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_ADMIN_URL), max: 2 }),
  api = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_URL), max: 2 }),
  worker = new pg.Pool({ connectionString: fixture.url(process.env.WORKER_DATABASE_URL), max: 1 });
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

let a: Coach,
  b: Coach,
  s1: Awaited<ReturnType<typeof pupil>>,
  s2: Awaited<ReturnType<typeof pupil>>,
  outsider: Awaited<ReturnType<typeof pupil>>,
  today: string;
const root = (owner = a) => `/v1/organizations/${owner.id}/commerce`;
beforeAll(async () => {
  const storage = await fixture.create();
  server = await buildApp({
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    storageRoot: storage,
    origin: 'http://localhost:5173',
    cookieSecret: 'commerce-test-cookie-secret-at-least-32-bytes',
  });
  server.addHook('onError', async (_req, _reply, error) => {
    if (error.code && !['P0001', '23505', '23503', '23514', '22P02'].includes(error.code))
      console.error({
        code: error.code,
        message: error.message,
        where: (error as { where?: string }).where,
      });
  });
  await server.ready();
  a = await coach('commerce-a');
  b = await coach('commerce-b');
  s1 = await pupil(a, 'Cliente Uno');
  s2 = await pupil(a, 'Cliente Dos');
  outsider = await pupil(b, 'Cliente Otro');
  await admin.query(
    "INSERT INTO organization_memberships(organization_id,user_id,role,status)VALUES($1,$2,'coach','active')",
    [a.id, b.userId],
  );
  today = (await a.http.call('GET', root())).json().today;
});
afterAll(async () => {
  await server?.close();
  await api.end();
  await worker.end();
  await admin.end();
  await fixture.drop();
});
async function service(doc: Record<string, unknown> = {}) {
  const id = randomUUID(),
    document = {
      name: 'Servicio ' + id.slice(0, 5),
      description: 'Prueba comercial sintética',
      kind: 'membership',
      currency: 'PYG',
      priceMinor: 10000,
      validityDays: 30,
      sessions: 0,
      capacity: 0,
      archived: false,
      ...doc,
    };
  const r = await a.http.call('PUT', root() + '/services/' + id, {
    requestId: randomUUID(),
    revision: 0,
    document,
  });
  expect(r.statusCode, r.body).toBe(200);
  return { id, document, revision: 1 };
}
type Service = Awaited<ReturnType<typeof service>>;
function saleBody(
  s: Service,
  learner = s1,
  start = today,
  parts?: { dueOn: string; amountMinor: number }[],
) {
  return {
    requestId: randomUUID(),
    document: {
      serviceId: s.id,
      serviceRevision: s.revision,
      studentId: learner.id,
      startsOn: start,
      renewalOf: null as string | null,
      installments: parts ?? [{ dueOn: start, amountMinor: Number(s.document.priceMinor) }],
    },
  };
}
async function sell(
  s: Service,
  learner = s1,
  start = today,
  parts?: { dueOn: string; amountMinor: number }[],
) {
  const id = randomUUID(),
    body = saleBody(s, learner, start, parts),
    r = await a.http.call('PUT', root() + '/contracts/' + id, body);
  expect(r.statusCode, r.body).toBe(200);
  return { id, body, detail: (await a.http.call('GET', root() + '/contracts/' + id)).json() };
}
async function pay(charge: string, amountMinor: number, extra: Record<string, unknown> = {}) {
  const body = {
      requestId: randomUUID(),
      amountMinor,
      paidOn: today,
      method: 'transfer',
      reference: 'QA-' + randomUUID(),
      ...extra,
    },
    r = await a.http.call('POST', root() + '/charges/' + charge + '/payments', body);
  expect(r.statusCode, r.body).toBe(200);
  return { id: r.json().id as string, body };
}

it('isolates commercial data and reserves CRM, exports and mutations to the owner', async () => {
  const s = await service(),
    c = await sell(s);
  expect((await s1.http.call('GET', root() + '/contracts/' + c.id)).statusCode).toBe(200);
  expect((await s2.http.call('GET', root() + '/contracts/' + c.id)).statusCode).toBe(404);
  expect((await outsider.http.call('GET', root() + '/contracts/' + c.id)).statusCode).toBe(404);
  expect((await b.http.call('GET', root() + '/contracts/' + c.id)).statusCode).toBe(404);
  expect((await s1.http.call('GET', root())).json().services).toEqual([]);
  for (const actor of [s1.http, b.http]) {
    expect((await actor.call('GET', root() + '/prospects')).statusCode).toBe(403);
    expect(
      (await actor.call('GET', root() + `/reports?from=${today}&to=${today}&csv=1`)).statusCode,
    ).toBe(403);
    expect(
      (
        await actor.call('PUT', root() + '/services/' + randomUUID(), {
          requestId: randomUUID(),
          revision: 0,
          document: s.document,
        })
      ).statusCode,
    ).toBe(403);
  }
  await expect(
    actorTransaction(api, a.userId, a.id, (db) => db.query('DELETE FROM coach_charges')),
  ).rejects.toMatchObject({ code: '42501' });
  const grant = await admin.query(
    "SELECT has_function_privilege('forma_api','app.coach_record(uuid,text,jsonb,jsonb)','EXECUTE') allowed",
  );
  expect(grant.rows[0].allowed).toBe(false);
});

it('freezes sold terms and exact installments while rejecting a stale or incomplete price', async () => {
  const s = await service({ kind: 'package', sessions: 8, priceMinor: 10001 });
  const c = await sell(s, s1, today, [
    { dueOn: today, amountMinor: 5001 },
    { dueOn: dateShift(today, 30), amountMinor: 5000 },
  ]);
  const updated = { ...s.document, priceMinor: 20000, validityDays: 60, sessions: 16 };
  expect(
    (
      await a.http.call('PUT', root() + '/services/' + s.id, {
        requestId: randomUUID(),
        revision: 1,
        document: updated,
      })
    ).statusCode,
  ).toBe(200);
  const saved = (await a.http.call('GET', root() + '/contracts/' + c.id)).json();
  expect(saved.contract.snapshot.priceMinor).toBe(10001);
  expect(saved.contract.snapshot.sessions).toBe(8);
  expect(saved.contract.endsOn).toBe(dateShift(today, 29));
  expect(saved.charges.map((h: { amountMinor: number }) => h.amountMinor)).toEqual([5001, 5000]);
  expect(
    (await a.http.call('PUT', root() + '/contracts/' + randomUUID(), saleBody(s, s2))).json().code,
  ).toBe('STALE_COMMERCE');
  const bad = saleBody({ ...s, revision: 2 }, s2);
  bad.document.installments = [{ dueOn: today, amountMinor: 19999 }];
  expect((await a.http.call('PUT', root() + '/contracts/' + randomUUID(), bad)).json().code).toBe(
    'COACH_INSTALLMENTS',
  );
  const retry = await a.http.call('PUT', root() + '/contracts/' + c.id, c.body);
  expect(retry.statusCode).toBe(200);
  await expect(
    admin.query('UPDATE coach_contracts SET total_minor=1 WHERE id=$1', [c.id]),
  ).rejects.toMatchObject({ message: 'COMMERCE_IMMUTABLE' });
});

it('records partial payments idempotently, guards references and serializes the remaining balance', async () => {
  const c = await sell(await service()),
    charge = c.detail.charges[0].id,
    p = await pay(charge, 4000);
  const retry = await a.http.call('POST', root() + '/charges/' + charge + '/payments', p.body);
  expect(retry.json().id).toBe(p.id);
  expect(
    (
      await a.http.call('POST', root() + '/charges/' + charge + '/payments', {
        ...p.body,
        amountMinor: 5000,
      })
    ).json().code,
  ).toBe('IDEMPOTENCY_CONFLICT');
  const responses = await Promise.all(
    [1, 2].map(() =>
      a.http.call('POST', root() + '/charges/' + charge + '/payments', {
        requestId: randomUUID(),
        amountMinor: 6000,
        paidOn: today,
        method: 'cash',
        reference: 'QA-' + randomUUID(),
      }),
    ),
  );
  expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  expect(
    (await a.http.call('GET', root() + '/contracts/' + c.id)).json().contract.balanceMinor,
  ).toBe(0);
  for (const amountMinor of ['100', 1.25, 0, -1])
    expect(
      (
        await a.http.call('POST', root() + '/charges/' + charge + '/payments', {
          ...p.body,
          requestId: randomUUID(),
          amountMinor,
        })
      ).statusCode,
    ).toBe(400);
  const other = await sell(await service());
  expect(
    (
      await a.http.call('POST', root() + '/charges/' + other.detail.charges[0].id + '/payments', {
        ...p.body,
        requestId: randomUUID(),
      })
    ).statusCode,
  ).toBe(409);
});

it('keeps receipts private, retains their storage reference and avoids duplicate files on retry', async () => {
  const c = await sell(await service()),
    image = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#225588' } })
      .png()
      .toBuffer();
  const p = await pay(c.detail.charges[0].id, 1000, {
    receiptDataUrl: 'data:image/png;base64,' + image.toString('base64'),
  });
  expect(
    (
      await a.http.call('POST', root() + '/charges/' + c.detail.charges[0].id + '/payments', p.body)
    ).json().id,
  ).toBe(p.id);
  const path = root() + '/payments/' + p.id + '/receipt';
  const owner = await a.http.call('GET', path);
  expect(owner.statusCode).toBe(200);
  expect(owner.headers['cache-control']).toContain('no-store');
  expect((await s1.http.call('GET', path)).statusCode).toBe(200);
  expect((await s2.http.call('GET', path)).statusCode).toBe(404);
  expect((await outsider.http.call('GET', path)).statusCode).toBe(404);
  const row = (await admin.query('SELECT receipt_key FROM coach_payments WHERE id=$1', [p.id]))
    .rows[0];
  const refs = (await worker.query('SELECT app.media_storage_references() key')).rows;
  expect(refs.some((r) => r.key === row.receipt_key)).toBe(true);
});

it('distinguishes refunds, corrections and debt adjustments without deleting financial history', async () => {
  const c = await sell(await service()),
    h = c.detail.charges[0].id,
    p = await pay(h, 10000),
    body = {
      requestId: randomUUID(),
      amountMinor: 2000,
      returnedOn: today,
      kind: 'refund',
      reason: 'Devolución parcial acordada con el cliente',
    };
  const r = await a.http.call('POST', root() + '/payments/' + p.id + '/return', body);
  expect(r.statusCode, r.body).toBe(200);
  expect(
    (await a.http.call('POST', root() + '/payments/' + p.id + '/return', body)).json(),
  ).toEqual(r.json());
  expect(
    (
      await a.http.call('POST', root() + '/payments/' + p.id + '/return', {
        ...body,
        requestId: randomUUID(),
        amountMinor: 9000,
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await a.http.call('POST', root() + '/charges/' + h + '/adjust', {
        requestId: randomUUID(),
        amountMinor: -3000,
        reason: 'Bonificación acordada tras devolución parcial',
      })
    ).json().code,
  ).toBe('COACH_BALANCE');
  expect(
    (
      await a.http.call('POST', root() + '/charges/' + h + '/adjust', {
        requestId: randomUUID(),
        amountMinor: -2000,
        reason: 'Bonificación acordada tras devolución parcial',
      })
    ).statusCode,
  ).toBe(200);
  const d = (await a.http.call('GET', root() + '/contracts/' + c.id)).json();
  expect(d.contract.balanceMinor).toBe(0);
  expect(d.contract.netPaidMinor).toBe(8000);
  expect(d.charges[0].adjustedMinor).toBe(8000);
  const c2 = await sell(await service()),
    p2 = await pay(c2.detail.charges[0].id, 5000);
  expect(
    (
      await a.http.call('POST', root() + '/payments/' + p2.id + '/return', {
        ...body,
        requestId: randomUUID(),
        amountMinor: 5000,
        kind: 'correction',
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (await a.http.call('GET', root() + '/contracts/' + c2.id)).json().charges[0].payments[0]
      .corrected,
  ).toBe(true);
  await expect(
    admin.query('DELETE FROM coach_refunds WHERE payment_id=$1', [p.id]),
  ).rejects.toMatchObject({ message: 'COMMERCE_IMMUTABLE' });
});

it('handles capacity, expiry and explicit renewal while preserving SaaS and agenda state', async () => {
  const s = await service({ capacity: 1, validityDays: 1 }),
    past = dateShift(today, -3),
    old = await sell(s, s1, past);
  expect(old.detail.contract.state).toBe('expired');
  const c = await sell(s);
  expect(
    (await a.http.call('PUT', root() + '/contracts/' + randomUUID(), saleBody(s, s2))).json().code,
  ).toBe('COACH_CAPACITY');
  expect(
    (await a.http.call('PUT', root() + '/contracts/' + randomUUID(), saleBody(s, s1))).json().code,
  ).toBe('COACH_OVERLAP');
  const renewal = saleBody(s, s1, dateShift(today, 1));
  renewal.document.renewalOf = c.id;
  const renewed = await a.http.call('PUT', root() + '/contracts/' + randomUUID(), renewal);
  expect(renewed.statusCode, renewed.body).toBe(200);
  const before = (
    await admin.query(
      'SELECT(SELECT count(*) FROM saas_invoices)n,(SELECT count(*) FROM saas_payments)p,(SELECT count(*) FROM student_billable_intervals)b,(SELECT count(*) FROM agenda_bookings)a',
    )
  ).rows[0];
  expect(
    (
      await a.http.call('POST', root() + '/contracts/' + c.id + '/cancel', {
        requestId: randomUUID(),
        revision: 1,
        reason: 'Cancelación comercial acordada, sin ajuste financiero',
      })
    ).statusCode,
  ).toBe(200);
  const after = (
    await admin.query(
      'SELECT(SELECT count(*) FROM saas_invoices)n,(SELECT count(*) FROM saas_payments)p,(SELECT count(*) FROM student_billable_intervals)b,(SELECT count(*) FROM agenda_bookings)a',
    )
  ).rows[0];
  expect(after).toEqual(before);
  const cancelled = (await a.http.call('GET', root() + '/contracts/' + c.id)).json().contract;
  expect(cancelled.state).toBe('cancelled');
  expect(cancelled.balanceMinor).toBe(10000);
  await sell(s, s2);
});

it('consumes only an attended booking in its package period and restores once with a ledger entry', async () => {
  const c = await sell(await service({ kind: 'package', sessions: 1 }), s1, dateShift(today, -1));
  const block = randomUUID(),
    event = randomUUID(),
    booking = randomUUID();
  await admin.query(
    "INSERT INTO agenda_availability(id,organization_id,professional_id,starts_at,ends_at,location)VALUES($1,$2,$3,now()-interval '3 hours',now()+interval '1 hour','Sala QA')",
    [block, a.id, a.userId],
  );
  await admin.query(
    "INSERT INTO agenda_events(id,organization_id,professional_id,availability_id,kind,title,instructions,location,starts_at,ends_at,capacity,booking_lead_minutes,cancel_lead_minutes,published)VALUES($1,$2,$3,$4,'class','Asistencia QA T12','','Sala QA',now()-interval '2 hours',now()-interval '1 hour',2,0,0,true)",
    [event, a.id, a.userId, block],
  );
  await admin.query(
    'INSERT INTO agenda_bookings(id,organization_id,event_id,student_id,user_id,starts_at,ends_at,cancel_until)SELECT $1,$2,$3,$4,$5,starts_at,ends_at,starts_at FROM agenda_events WHERE id=$3',
    [booking, a.id, event, s1.id, s1.userId],
  );
  const body = {
    requestId: randomUUID(),
    kind: 'use',
    referenceId: booking,
    reason: 'Descuento manual de asistencia confirmada',
  };
  expect(
    (await a.http.call('POST', root() + '/contracts/' + c.id + '/sessions', body)).json().code,
  ).toBe('COACH_SESSION');
  const attend = await a.http.call(
    'POST',
    `/v1/organizations/${a.id}/agenda/bookings/${booking}/attendance`,
    { requestId: randomUUID(), revision: 1, state: 'attended' },
  );
  expect(attend.statusCode, attend.body).toBe(200);
  const use = await a.http.call('POST', root() + '/contracts/' + c.id + '/sessions', body);
  expect(use.statusCode, use.body).toBe(200);
  expect(
    (await a.http.call('POST', root() + '/contracts/' + c.id + '/sessions', body)).json().id,
  ).toBe(use.json().id);
  expect(
    (await a.http.call('GET', root() + '/contracts/' + c.id)).json().contract.remainingSessions,
  ).toBe(0);
  const restore = await a.http.call('POST', root() + '/contracts/' + c.id + '/sessions', {
    requestId: randomUUID(),
    kind: 'restore',
    referenceId: use.json().id,
    reason: 'Corrección documentada del descuento de sesión',
  });
  expect(restore.statusCode, restore.body).toBe(200);
  expect(
    (await a.http.call('GET', root() + '/contracts/' + c.id)).json().contract.remainingSessions,
  ).toBe(1);
  expect(
    (
      await a.http.call('POST', root() + '/contracts/' + c.id + '/sessions', {
        ...body,
        requestId: randomUUID(),
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await a.http.call('POST', root() + '/contracts/' + c.id + '/sessions', {
        requestId: randomUUID(),
        kind: 'restore',
        referenceId: use.json().id,
        reason: 'Intento repetido de restauración de sesión',
      })
    ).json().code,
  ).toBe('COACH_SESSION');
});

it('converts a prospect to an existing student once and erases closed personal data with bounded retention', async () => {
  const id = randomUUID(),
    document = {
      name: 'Prospecto comercial',
      email: s1.email,
      phone: '+595000000',
      source: 'Referencia QA',
      stage: 'contacted',
      nextAction: 'Llamada acordada',
      nextOn: today,
      notes: 'Datos comerciales sintéticos',
    };
  expect(
    (
      await a.http.call('PUT', root() + '/prospects/' + id, {
        requestId: randomUUID(),
        revision: 0,
        document,
      })
    ).statusCode,
  ).toBe(200);
  const command = { requestId: randomUUID(), revision: 1 },
    before = (await admin.query('SELECT count(*) n FROM students WHERE organization_id=$1', [a.id]))
      .rows[0].n;
  const converted = await a.http.call('POST', root() + '/prospects/' + id + '/convert', command);
  expect(converted.statusCode, converted.body).toBe(200);
  expect(converted.json().studentId).toBe(s1.id);
  expect(
    (await a.http.call('POST', root() + '/prospects/' + id + '/convert', command)).json(),
  ).toEqual(converted.json());
  expect(
    (await admin.query('SELECT count(*) n FROM students WHERE organization_id=$1', [a.id])).rows[0]
      .n,
  ).toBe(before);
  const fresh = randomUUID();
  await a.http.call('PUT', root() + '/prospects/' + fresh, {
    requestId: randomUUID(),
    revision: 0,
    document: {
      ...document,
      name: 'Nuevo cliente',
      email: 'nuevo-' + randomUUID() + '@example.test',
    },
  });
  const created = await a.http.call('POST', root() + '/prospects/' + fresh + '/convert', {
    requestId: randomUUID(),
    revision: 1,
  });
  expect(created.statusCode, created.body).toBe(200);
  expect(
    (await admin.query('SELECT status FROM students WHERE id=$1', [created.json().studentId]))
      .rows[0].status,
  ).toBe('invited');
  const erase = await a.http.call('POST', root() + '/prospects/' + id + '/erase', {
    requestId: randomUUID(),
    revision: 2,
  });
  expect(erase.statusCode).toBe(200);
  const p = (
    await admin.query(
      'SELECT name,email,phone,notes,student_id,stage FROM coach_prospects WHERE id=$1',
      [id],
    )
  ).rows[0];
  expect(p).toEqual({
    name: 'Datos eliminados',
    email: '',
    phone: '',
    notes: '',
    student_id: null,
    stage: 'erased',
  });
  await admin.query("UPDATE coach_prospects SET closed_at=now()-interval '91 days' WHERE id=$1", [
    fresh,
  ]);
  expect((await worker.query('SELECT app.coach_retention_tick() n')).rows[0].n).toBe(1);
  expect(
    (await admin.query('SELECT email,stage FROM coach_prospects WHERE id=$1', [fresh])).rows[0],
  ).toEqual({ email: '', stage: 'erased' });
});

it('reports real cash separately by currency, excludes corrected payments and exports numeric CSV', async () => {
  const day = dateShift(today, -33),
    returnedOn = dateShift(day, 1),
    c = await sell(await service()),
    h = c.detail.charges[0].id;
  expect(c.detail.contract.nextDueOn).toBe(today);
  const p = await pay(h, 10000, { paidOn: day });
  await a.http.call('POST', root() + '/payments/' + p.id + '/return', {
    requestId: randomUUID(),
    amountMinor: 4000,
    returnedOn,
    kind: 'refund',
    reason: 'Devolución real en el siguiente día del periodo',
  });
  const usd = await sell(await service({ currency: 'USD', priceMinor: 1234 }));
  await pay(usd.detail.charges[0].id, 1234, { paidOn: day });
  const wrong = await sell(await service()),
    w = await pay(wrong.detail.charges[0].id, 5000, { paidOn: day });
  await a.http.call('POST', root() + '/payments/' + w.id + '/return', {
    requestId: randomUUID(),
    amountMinor: 5000,
    returnedOn,
    kind: 'correction',
    reason: 'Pago registrado por error sin movimiento real',
  });
  const response = await a.http.call('GET', root() + `/reports?from=${day}&to=${returnedOn}`);
  expect(response.statusCode, response.body).toBe(200);
  const rows = response.json().summary;
  expect(rows.find((r: { currency: string }) => r.currency === 'PYG')).toMatchObject({
    grossMinor: '10000',
    refundsMinor: '4000',
    netMinor: '6000',
  });
  expect(rows.find((r: { currency: string }) => r.currency === 'USD')).toMatchObject({
    grossMinor: '1234',
    netMinor: '1234',
  });
  const csv = await a.http.call('GET', root() + `/reports?from=${day}&to=${returnedOn}&csv=1`);
  expect(csv.statusCode).toBe(200);
  expect(csv.headers['content-type']).toContain('text/csv');
  expect(csv.body).toContain('PYG,');
  expect(csv.body).not.toContain(s1.email);
  expect(
    (await a.http.call('GET', root() + `/reports?from=${today}&to=${dateShift(today, 367)}`))
      .statusCode,
  ).toBe(400);
});
