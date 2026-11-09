import { approveFixtureCoach } from '../helpers/coach-approval.js';
import 'dotenv/config';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildApp } from '../../apps/api/src/app.js';
import { actorTransaction } from '../../apps/api/src/organizations.js';
import { isolatedDatabase } from '../helpers/database.js';
import { agendaTick } from '../../apps/worker/src/agenda.js';
import { zonedLocal } from '@forma/shared';
const fixture = isolatedDatabase(),
  admin = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_ADMIN_URL), max: 2 }),
  api = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_URL), max: 2 }),
  worker = new pg.Pool({ connectionString: fixture.url(process.env.WORKER_DATABASE_URL), max: 2 });
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
  return { id, http, userId: (await http.call('GET', '/v1/auth/me')).json().user.id };
}

let a: Coach,
  b: Coach,
  s1: Awaited<ReturnType<typeof pupil>>,
  s2: Awaited<ReturnType<typeof pupil>>,
  s3: Awaited<ReturnType<typeof pupil>>,
  slot = 0;
const root = (owner = a) => '/v1/organizations/' + owner.id + '/agenda';
const zone = 'America/Asuncion';
const future = () =>
  new Date(
    Math.floor((Date.now() + 4 * 86400000 + slot++ * 5 * 3600000) / 3600000) * 3600000,
  ).toISOString();
const shift = (stamp: string, minutes: number) =>
  new Date(Date.parse(stamp) + minutes * 60000).toISOString();
const timing = (start: string, end: string) => ({
  timezone: zone,
  localStartsAt: zonedLocal(start, zone),
  localEndsAt: zonedLocal(end, zone),
});
beforeAll(async () => {
  await fixture.create();
  server = await buildApp({
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    origin: 'http://localhost:5173',
    cookieSecret: 'agenda-test-cookie-secret-at-least-32-bytes',
  });
  server.addHook('onError', async (_req, _reply, error) => {
    if (error.code && !['P0001', '23P01', '23505', '23514', '22P02'].includes(error.code))
      console.error({
        code: error.code,
        message: error.message,
        where: (error as { where?: string }).where,
      });
  });
  await server.ready();
  a = await coach('agenda-a');
  b = await coach('agenda-b');
  s1 = await pupil(a, 'Alumno Agenda Uno');
  s2 = await pupil(a, 'Alumno Agenda Dos');
  s3 = await pupil(b, 'Alumno Agenda Tres');
  await admin.query(
    "INSERT INTO organization_memberships(organization_id,user_id,role,status)VALUES($1,$2,'coach','active')",
    [a.id, b.userId],
  );
  for (const [organization, user] of [
    [a.id, a.userId],
    [a.id, s1.userId],
    [a.id, s2.userId],
    [b.id, b.userId],
    [b.id, s3.userId],
  ])
    await admin.query(
      'INSERT INTO agenda_preferences(organization_id,user_id,quiet_start,quiet_end)VALUES($1,$2,0,0)',
      [organization, user],
    );
});
afterAll(async () => {
  await server?.close();
  await Promise.all([admin.end(), api.end(), worker.end()]);
  await fixture.drop();
});
async function block(owner = a, prof = owner.userId, start = future()) {
  const id = randomUUID(),
    end = shift(start, 180);
  const body = {
    revision: 0,
    requestId: randomUUID(),
    professionalId: prof,
    startsAt: shift(start, -60),
    endsAt: end,
    location: 'Sala sintética',
    ...timing(shift(start, -60), end),
  };
  const response = await owner.http.call('PUT', root(owner) + '/availability/' + id, body);
  expect(response.statusCode, response.body).toBe(200);
  return { id, start, body };
}
async function session(
  options: {
    owner?: Coach;
    prof?: string;
    capacity?: number;
    start?: string;
    cancelLead?: number;
    bookLead?: number;
    published?: boolean;
  } = {},
) {
  const owner = options.owner ?? a,
    prof = options.prof ?? owner.userId,
    availability = await block(owner, prof, options.start),
    id = randomUUID(),
    document = {
      professionalId: prof,
      availabilityId: availability.id,
      kind: 'class',
      title: 'Sesión sintética',
      instructions: 'Material de prueba.',
      location: 'Sala 1',
      startsAt: availability.start,
      endsAt: shift(availability.start, 60),
      capacity: options.capacity ?? 2,
      bookingLeadMinutes: options.bookLead ?? 0,
      cancelLeadMinutes: options.cancelLead ?? 0,
      published: options.published ?? true,
    },
    body = {
      revision: 0,
      requestId: randomUUID(),
      document,
      reason: '',
      ...timing(document.startsAt, document.endsAt),
    };
  const response = await owner.http.call('PUT', root(owner) + '/events/' + id, body);
  expect(response.statusCode, response.body).toBe(200);
  return { id, availability, document, body, owner };
}
async function reserve(
  event: Awaited<ReturnType<typeof session>>,
  student = s1,
  requestId = randomUUID(),
) {
  return student.http.call('POST', root(event.owner) + '/events/' + event.id + '/book', {
    studentId: student.id,
    requestId,
  });
}
async function enable(owner: Coach, kind: string, on = true, leadMinutes = 1440) {
  const rules = (await owner.http.call('GET', root(owner) + '/rules')).json().rules,
    rule = rules.find((r: { kind: string }) => r.kind === kind);
  expect(rule).toBeTruthy();
  const response = await owner.http.call('POST', root(owner) + '/rules/' + rule.id, {
    revision: rule.revision,
    requestId: randomUUID(),
    enabled: on,
    leadMinutes: kind === 'welcome' ? 0 : leadMinutes,
  });
  expect(response.statusCode, response.body).toBe(200);
  return { id: rule.id, revision: rule.revision + 1 };
}
it('isolates calendars, student rosters, rules and tenant access without granting private chat', async () => {
  const event = await session(),
    foreign = await session({ owner: b });
  const home = await s1.http.call('GET', root());
  expect(home.statusCode, home.body).toBe(200);
  expect(home.json().timezone).toBe(zone);
  expect(home.json().studentId).toBe(s1.id);
  expect((await b.http.call('GET', root() + '/events/' + event.id)).statusCode).toBe(404);
  expect((await s1.http.call('GET', root(b) + '/events/' + foreign.id)).statusCode).toBe(404);
  const visible = (await s1.http.call('GET', root() + '/events/' + event.id)).json();
  expect(visible.bookings).toEqual([]);
  expect(visible.people).toEqual([]);
  expect((await s1.http.call('GET', root() + '/rules')).statusCode).toBe(403);
  expect((await b.http.call('GET', root() + '/rules')).statusCode).toBe(403);
  const draft = await session({ published: false });
  expect((await s1.http.call('GET', root() + '/events/' + draft.id)).statusCode).toBe(404);
  await actorTransaction(api, s1.userId, a.id, async (db) => {
    expect((await db.query('SELECT * FROM agenda_bookings')).rows).toEqual([]);
    await expect(
      db.query('DELETE FROM agenda_events WHERE id=$1', [event.id]),
    ).rejects.toMatchObject({ code: '42501' });
  });
  expect(
    (
      await api.query(
        "SELECT has_function_privilege(current_user,'app.agenda_emit(uuid,text,text,uuid,uuid,uuid,uuid,integer,timestamptz,timestamptz)','EXECUTE') allowed",
      )
    ).rows[0].allowed,
  ).toBe(false);
});
it('serializes the last seat, preserves exact retry receipts and exposes no other pupil names', async () => {
  const event = await session({ capacity: 1 }),
    id1 = randomUUID(),
    id2 = randomUUID(),
    responses = await Promise.all([reserve(event, s1, id1), reserve(event, s2, id2)]);
  expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  const index = responses.findIndex((r) => r.statusCode === 200),
    student = index === 0 ? s1 : s2,
    request = index === 0 ? id1 : id2,
    receipt = responses[index]!.json();
  expect((await reserve(event, student, request)).json()).toEqual(receipt);
  const owner = (await a.http.call('GET', root() + '/events/' + event.id)).json();
  expect(owner.bookings.filter((x: { status: string }) => x.status === 'confirmed')).toHaveLength(
    1,
  );
  expect(owner.event.confirmed).toBe(1);
  const other = (
    await (index === 0 ? s2 : s1).http.call('GET', root() + '/events/' + event.id)
  ).json();
  expect(other.bookings).toEqual([]);
  expect(other.event.ownBooking).toBeNull();
});
it('rejects professional and pupil overlaps, permits adjacent sessions and detects timezone mismatch', async () => {
  const first = await session(),
    conflict = await a.http.call('PUT', root() + '/events/' + randomUUID(), {
      ...first.body,
      requestId: randomUUID(),
      document: { ...first.document, title: 'Solapada' },
    });
  expect(conflict.statusCode, conflict.body).toBe(409);
  expect(conflict.json().code).toBe('AGENDA_OVERLAP');
  const adjacent = await a.http.call('PUT', root() + '/events/' + randomUUID(), {
    ...first.body,
    requestId: randomUUID(),
    document: {
      ...first.document,
      startsAt: first.document.endsAt,
      endsAt: shift(first.document.endsAt, 60),
    },
    ...timing(first.document.endsAt, shift(first.document.endsAt, 60)),
  });
  expect(adjacent.statusCode, adjacent.body).toBe(200);
  await admin.query(
    'INSERT INTO student_professionals(organization_id,student_id,professional_user_id)VALUES($1,$2,$3)',
    [a.id, s1.id, b.userId],
  );
  const second = await session({ prof: b.userId, start: first.document.startsAt });
  expect((await reserve(first)).statusCode).toBe(200);
  const busy = await reserve(second);
  expect(busy.statusCode, busy.body).toBe(409);
  expect(busy.json().code).toBe('AGENDA_OVERLAP');
  const badZone = await a.http.call('PUT', root() + '/events/' + first.id, {
    ...first.body,
    revision: 1,
    requestId: randomUUID(),
    localStartsAt: '2024-11-03T01:30',
  });
  expect(badZone.statusCode).toBe(409);
  expect(badZone.json().code).toBe('AGENDA_TIMEZONE');
});
it('enforces cancellation windows, records staff exceptions and notifies edits without losing reservations', async () => {
  const event = await session({ cancelLead: 10080 }),
    r1 = await reserve(event),
    r2 = await reserve(event, s2);
  expect(r1.statusCode, r1.body).toBe(200);
  expect(r2.statusCode, r2.body).toBe(200);
  expect(
    (
      await s1.http.call('POST', root() + '/bookings/' + r1.json().id + '/cancel', {
        revision: 1,
        requestId: randomUUID(),
        reason: '',
      })
    ).json().code,
  ).toBe('AGENDA_CUTOFF');
  const late = await a.http.call('POST', root() + '/bookings/' + r1.json().id + '/cancel', {
    revision: 1,
    requestId: randomUUID(),
    reason: 'Excepción manual acordada con el alumno',
  });
  expect(late.statusCode, late.body).toBe(200);
  expect(
    (await a.http.call('GET', root() + '/events/' + event.id))
      .json()
      .bookings.find((x: { id: string }) => x.id === r1.json().id).late,
  ).toBe(true);
  const revised = {
    ...event.body,
    revision: 1,
    requestId: randomUUID(),
    document: {
      ...event.document,
      startsAt: shift(event.document.startsAt, 30),
      endsAt: shift(event.document.endsAt, 30),
    },
    reason: 'Ajuste de horario acordado con las personas inscritas',
    ...timing(shift(event.document.startsAt, 30), shift(event.document.endsAt, 30)),
  };
  const edit = await a.http.call('PUT', root() + '/events/' + event.id, revised);
  expect(edit.statusCode, edit.body).toBe(200);
  const own = (await s2.http.call('GET', root() + '/events/' + event.id)).json().event.ownBooking;
  expect(Date.parse(own.cancelUntil)).toBe(Date.parse(revised.document.startsAt));
  expect(
    (
      await a.http.call('PUT', root() + '/events/' + event.id, {
        ...revised,
        requestId: randomUUID(),
      })
    ).statusCode,
  ).toBe(409);
  const protectedBlock = await a.http.call(
    'POST',
    root() + '/availability/' + event.availability.id + '/cancel',
    { revision: 1, requestId: randomUUID() },
  );
  expect(protectedBlock.json().code).toBe('AGENDA_REFERENCED');
  expect(
    (
      await a.http.call('POST', root() + '/events/' + event.id + '/cancel', {
        revision: 2,
        requestId: randomUUID(),
        reason: 'Sesión cancelada por cambio de disponibilidad',
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (await s2.http.call('GET', root() + '/events/' + event.id)).json().event.ownBooking.status,
  ).toBe('cancelled');
});
it('records attendance with CAS and exact retries only after session start', async () => {
  const event = await session(),
    book = await reserve(event);
  expect(book.statusCode, book.body).toBe(200);
  const payload = { revision: 1, requestId: randomUUID(), state: 'attended' };
  expect(
    (
      await a.http.call('POST', root() + '/bookings/' + book.json().id + '/attendance', payload)
    ).json().code,
  ).toBe('AGENDA_CUTOFF');
  await admin.query(
    "UPDATE agenda_events SET starts_at=now()-interval '30 minutes',ends_at=now()+interval '30 minutes' WHERE id=$1",
    [event.id],
  );
  await admin.query(
    "UPDATE agenda_bookings SET starts_at=now()-interval '30 minutes',ends_at=now()+interval '30 minutes' WHERE id=$1",
    [book.json().id],
  );
  const attended = await a.http.call(
    'POST',
    root() + '/bookings/' + book.json().id + '/attendance',
    payload,
  );
  expect(attended.statusCode, attended.body).toBe(200);
  expect(
    (
      await a.http.call('POST', root() + '/bookings/' + book.json().id + '/attendance', payload)
    ).json(),
  ).toEqual(attended.json());
  expect(
    (
      await s1.http.call('POST', root() + '/bookings/' + book.json().id + '/attendance', {
        ...payload,
        requestId: randomUUID(),
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (await a.http.call('GET', root() + '/events/' + event.id)).json().bookings[0].attendance,
  ).toBe('attended');
});
it('publishes immutable rule versions, previews without delivery and pauses queued welcome notices', async () => {
  const initial = (await a.http.call('GET', root() + '/rules')).json().rules;
  expect(initial.every((r: { enabled: boolean }) => !r.enabled)).toBe(true);
  const disabledWelcome = initial.find((r: { kind: string }) => r.kind === 'welcome');
  expect(
    (await a.http.call('GET', root() + '/rules/' + disabledWelcome.id + '/preview')).json()
      .recipients,
  ).toHaveLength(0);
  const rule = await enable(a, 'welcome'),
    newPupil = await pupil(a, 'Bienvenida sintética');
  await admin.query(
    'INSERT INTO agenda_preferences(organization_id,user_id,quiet_start,quiet_end)VALUES($1,$2,0,0)',
    [a.id, newPupil.userId],
  );
  const preview = await a.http.call('GET', root() + '/rules/' + rule.id + '/preview');
  expect(preview.statusCode, preview.body).toBe(200);
  expect(
    preview.json().recipients.some((x: { name: string }) => x.name === 'Bienvenida sintética'),
  ).toBe(true);
  expect(
    (
      await admin.query('SELECT count(*)::int n FROM agenda_notifications WHERE user_id=$1', [
        newPupil.userId,
      ])
    ).rows[0].n,
  ).toBe(0);
  const version = (
    await admin.query('SELECT current_version_id FROM agenda_rules WHERE id=$1', [rule.id])
  ).rows[0].current_version_id;
  await expect(
    admin.query("UPDATE agenda_rule_versions SET document='{}' WHERE id=$1", [version]),
  ).rejects.toMatchObject({ message: 'IMMUTABLE_VERSION' });
  await agendaTick(worker, 0);
  await enable(a, 'welcome', false);
  await agendaTick(worker);
  const run = (
    await admin.query(
      "SELECT run.status,run.reason FROM agenda_runs run JOIN agenda_outbox o ON o.id=run.outbox_id WHERE o.recipient_id=$1 AND o.kind='welcome'",
      [newPupil.userId],
    )
  ).rows[0];
  expect(run).toEqual({ status: 'skipped', reason: 'RULE_CHANGED_OR_PAUSED' });
  expect(
    (
      await admin.query('SELECT count(*)::int n FROM agenda_notifications WHERE user_id=$1', [
        newPupil.userId,
      ])
    ).rows[0].n,
  ).toBe(0);
});
it('deduplicates due reminders, respects preferences and defers daily limits without burning retries', async () => {
  const start = shift(new Date(Math.floor(Date.now() / 60000) * 60000).toISOString(), 120),
    event = await session({ owner: b, start }),
    book = await reserve(event, s3);
  expect(book.statusCode, book.body).toBe(200);
  await enable(b, 'appointment.soon', true, 1440);
  await admin.query(
    'UPDATE agenda_preferences SET booking=false,reminder=false WHERE organization_id=$1 AND user_id=$2',
    [b.id, s3.userId],
  );
  await agendaTick(worker);
  const row = (
    await admin.query(
      "SELECT run.status,run.reason FROM agenda_runs run JOIN agenda_outbox o ON o.id=run.outbox_id WHERE o.booking_id=$1 AND o.kind='appointment.soon'",
      [book.json().id],
    )
  ).rows[0];
  expect(row).toEqual({ status: 'skipped', reason: 'PREFERENCE' });
  await agendaTick(worker);
  expect(
    (
      await admin.query(
        "SELECT count(*)::int n FROM agenda_outbox WHERE booking_id=$1 AND kind='appointment.soon'",
        [book.json().id],
      )
    ).rows[0].n,
  ).toBe(1);
  await admin.query(
    'UPDATE agenda_preferences SET booking=true,reminder=true,daily_limit=1 WHERE organization_id=$1 AND user_id=$2',
    [b.id, s3.userId],
  );
  const next = await session({ owner: b }),
    second = await reserve(next, s3);
  expect(second.statusCode, second.body).toBe(200);
  await agendaTick(worker);
  const third = await session({ owner: b }),
    thirdBook = await reserve(third, s3);
  expect(thirdBook.statusCode, thirdBook.body).toBe(200);
  await agendaTick(worker);
  const pending = (
    await admin.query(
      "SELECT run.reason,j.status,j.attempts,j.available_at>now() waiting FROM agenda_runs run JOIN agenda_outbox o ON o.id=run.outbox_id JOIN jobs j ON j.id=run.job_id WHERE o.booking_id=$1 AND o.kind='booking.confirmed' AND o.recipient_id=$2",
      [thirdBook.json().id, s3.userId],
    )
  ).rows[0];
  expect(pending).toEqual({ reason: 'DAILY_LIMIT', status: 'ready', attempts: 0, waiting: true });
  await admin.query(
    'UPDATE agenda_preferences SET daily_limit=20 WHERE organization_id=$1 AND user_id=$2',
    [b.id, s3.userId],
  );
});
it('uses organization quiet hours through DST and retries only technical failures without duplicate delivery', async () => {
  await admin.query("UPDATE organizations SET timezone='America/New_York' WHERE id=$1", [b.id]);
  await admin.query(
    'UPDATE agenda_preferences SET quiet_start=1320,quiet_end=420 WHERE organization_id=$1 AND user_id=$2',
    [b.id, s3.userId],
  );
  const quiet = (
    await admin.query("SELECT app.agenda_next_notice($1,$2,'2024-11-03T05:30:00Z') next_at", [
      b.id,
      s3.userId,
    ])
  ).rows[0].next_at;
  expect(quiet.toISOString()).toBe('2024-11-03T12:00:00.000Z');
  await admin.query("UPDATE organizations SET timezone='America/Asuncion' WHERE id=$1", [b.id]);
  await admin.query(
    'UPDATE agenda_preferences SET quiet_start=0,quiet_end=0,daily_limit=20,booking=true WHERE organization_id=$1 AND user_id=$2',
    [b.id, s3.userId],
  );
  const event = await session({ owner: b }),
    book = await reserve(event, s3);
  expect(book.statusCode, book.body).toBe(200);
  await agendaTick(worker, 0);
  const execution = (
      await admin.query(
        "SELECT run.id,run.job_id FROM agenda_runs run JOIN agenda_outbox o ON o.id=run.outbox_id WHERE o.booking_id=$1 AND o.recipient_id=$2 AND o.kind='booking.confirmed'",
        [book.json().id, s3.userId],
      )
    ).rows[0],
    lease = randomUUID();
  await admin.query(
    "UPDATE jobs SET status='running',attempts=3,lease_token=$2,leased_until=now()+interval '2 minutes' WHERE id=$1",
    [execution.job_id, lease],
  );
  await worker.query('SELECT app.worker_agenda_fail($1,$2)', [execution.job_id, lease]);
  const revision = (
      await admin.query('SELECT revision FROM agenda_runs WHERE id=$1', [execution.id])
    ).rows[0].revision,
    body = { revision, requestId: randomUUID() };
  const retry = await b.http.call('POST', root(b) + '/runs/' + execution.id + '/retry', body);
  expect(retry.statusCode, retry.body).toBe(200);
  expect(
    (await b.http.call('POST', root(b) + '/runs/' + execution.id + '/retry', body)).json(),
  ).toEqual(retry.json());
  await agendaTick(worker);
  await agendaTick(worker);
  expect(
    (
      await admin.query('SELECT count(*)::int n FROM agenda_notifications WHERE run_id=$1', [
        execution.id,
      ])
    ).rows[0].n,
  ).toBe(1);
  expect(
    (
      await b.http.call('POST', root(b) + '/runs/' + execution.id + '/retry', {
        revision: 999,
        requestId: randomUUID(),
      })
    ).statusCode,
  ).toBe(409);
});
it('bridges pending check-ins only with their own consent and suppresses delivery after revocation', async () => {
  const thread = (
    await b.http.call('POST', `/v1/organizations/${b.id}/followup/threads`, {
      studentId: s3.id,
      professionalId: b.userId,
    })
  ).json().id;
  expect(thread).toBeTruthy();
  const consent = await s3.http.call(
    'PUT',
    `/v1/organizations/${b.id}/followup/threads/${thread}/settings`,
    { revision: 0, muted: false, trackingConsent: true },
  );
  expect(consent.statusCode, consent.body).toBe(200);
  const template = randomUUID(),
    version = randomUUID(),
    schedule = randomUUID(),
    task = randomUUID();
  await admin.query(
    'INSERT INTO followup_checkin_templates(id,organization_id,created_by,document)VALUES($1,$2,$3,\'{"name":"Ficticio","description":"","fields":[]}\')',
    [template, b.id, b.userId],
  );
  await admin.query(
    'INSERT INTO followup_checkin_versions(id,organization_id,template_id,source_revision,number,document)VALUES($1,$2,$3,1,1,\'{"name":"Ficticio","description":"","fields":[]}\')',
    [version, b.id, template],
  );
  await admin.query(
    "INSERT INTO followup_checkin_schedules(id,organization_id,thread_id,version_id,frequency,weekday,month_day,window_days,starts_on,ends_on)VALUES($1,$2,$3,$4,'weekly',1,1,7,current_date-1,current_date+7)",
    [schedule, b.id, thread, version],
  );
  await admin.query(
    'INSERT INTO followup_checkin_tasks(id,organization_id,schedule_id,scheduled_on,closes_on)VALUES($1,$2,$3,current_date-1,current_date+1)',
    [task, b.id, schedule],
  );
  await enable(b, 'checkin.pending', true, 5);
  const pendingRule = (await b.http.call('GET', root(b) + '/rules'))
    .json()
    .rules.find((r: { kind: string }) => r.kind === 'checkin.pending');
  expect(
    (await b.http.call('GET', root(b) + '/rules/' + pendingRule.id + '/preview')).json().recipients,
  ).toHaveLength(1);
  await admin.query(
    'DELETE FROM student_professionals WHERE organization_id=$1 AND student_id=$2 AND professional_user_id=$3',
    [b.id, s3.id, b.userId],
  );
  expect(
    (await b.http.call('GET', root(b) + '/rules/' + pendingRule.id + '/preview')).json().recipients,
  ).toHaveLength(0);
  await admin.query(
    'INSERT INTO student_professionals(organization_id,student_id,professional_user_id)VALUES($1,$2,$3)',
    [b.id, s3.id, b.userId],
  );
  await agendaTick(worker, 0);
  const changed = await s3.http.call(
    'PUT',
    `/v1/organizations/${b.id}/followup/threads/${thread}/settings`,
    { revision: 1, muted: false, trackingConsent: false },
  );
  expect(changed.statusCode, changed.body).toBe(200);
  await agendaTick(worker);
  const execution = (
    await admin.query(
      "SELECT run.status,run.reason FROM agenda_runs run JOIN agenda_outbox o ON o.id=run.outbox_id WHERE o.task_id=$1 AND o.kind='checkin.pending'",
      [task],
    )
  ).rows[0];
  expect(execution).toEqual({ status: 'skipped', reason: 'ACCESS_CHANGED' });
});
