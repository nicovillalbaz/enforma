import { approveFixtureCoach } from '../helpers/coach-approval.js';
import 'dotenv/config';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { buildApp } from '../../apps/api/src/app.js';
import { actorTransaction } from '../../apps/api/src/organizations.js';
import { isolatedDatabase } from '../helpers/database.js';
import { claimMediaJob, processMediaJob, runMediaCommand } from '../../apps/worker/src/media.js';
import { PrivateStorage } from '../../apps/api/src/storage.js';
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
const fixture = isolatedDatabase(),
  admin = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_ADMIN_URL), max: 2 }),
  api = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_URL), max: 2 }),
  worker = new pg.Pool({ connectionString: fixture.url(process.env.WORKER_DATABASE_URL), max: 2 });
let server: Awaited<ReturnType<typeof buildApp>>,
  directory: string,
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
  root: string,
  today: string;
beforeAll(async () => {
  directory = await fixture.create();
  server = await buildApp({
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    origin: 'http://localhost:5173',
    cookieSecret: 'followup-test-cookie-secret-32-bytes',
    storageRoot: directory,
  });
  await server.ready();
  a = await coach('followup-a');
  b = await coach('followup-b');
  s1 = await pupil(a, 'Alumno Seguimiento');
  s2 = await pupil(a, 'Otro Alumno');
  root = '/v1/organizations/' + a.id + '/followup';
  today = (
    await admin.query('SELECT (now() AT TIME ZONE \'America/Asuncion\')::date::text AS "day"')
  ).rows[0].day;
  await admin.query(
    "INSERT INTO organization_memberships(organization_id,user_id,role,status)VALUES($1,$2,'coach','active')",
    [a.id, b.userId],
  );
  await admin.query(
    'INSERT INTO student_professionals(organization_id,student_id,professional_user_id)VALUES($1,$2,$3)',
    [a.id, s1.id, b.userId],
  );
});
afterAll(async () => {
  await server?.close();
  await Promise.all([admin.end(), api.end(), worker.end()]);
  await fixture.drop();
});
async function opened(http = a.http, student = s1.id, prof = a.userId) {
  const r = await http.call('POST', root + '/threads', {
    studentId: student,
    professionalId: prof,
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().id as string;
}
async function send(
  id: string,
  body: string,
  http = a.http,
  clientId = randomUUID(),
  attachments: string[] = [],
) {
  return http.call('POST', root + '/threads/' + id + '/messages', { clientId, body, attachments });
}
async function consent(id: string, enabled = true, revision = 0) {
  const r = await s1.http.call('PUT', root + '/threads/' + id + '/settings', {
    revision,
    muted: false,
    trackingConsent: enabled,
  });
  expect(r.statusCode, r.body).toBe(200);
}
async function currentConsent(id: string, enabled = true) {
  const d = (await s1.http.call('GET', root + '/threads/' + id + '/messages')).json();
  await consent(id, enabled, d.settings.revision);
}
it('isolates pairs, including the owner of another professional conversation and raw RLS', async () => {
  const thread = await opened(b.http, s1.id, b.userId);
  expect((await a.http.call('GET', root + '/threads/' + thread + '/messages')).statusCode).toBe(
    404,
  );
  expect((await s2.http.call('GET', root + '/threads/' + thread + '/messages')).statusCode).toBe(
    404,
  );
  expect(
    (await b.http.call('GET', root.replace(a.id, b.id) + '/threads/' + thread + '/messages'))
      .statusCode,
  ).toBe(404);
  await actorTransaction(api, a.userId, a.id, async (db) => {
    expect((await db.query('SELECT * FROM followup_threads WHERE id=$1', [thread])).rowCount).toBe(
      0,
    );
    await expect(
      db.query('SELECT app.followup_notice($1,$2,$3,$4)', [thread, a.userId, 'message', 'attack']),
    ).rejects.toMatchObject({ code: '42501' });
  });
});
it('persists concurrent ordering, exact retries, pagination and monotonic reading', async () => {
  const thread = await opened(),
    clientId = randomUUID();
  const sent = await send(thread, 'Uno', a.http, clientId);
  expect(sent.statusCode, sent.body).toBe(200);
  const duplicate = await send(thread, 'Uno', a.http, clientId);
  expect(duplicate.json()).toEqual(sent.json());
  expect((await send(thread, 'Otro contenido', a.http, clientId)).statusCode).toBe(409);
  const concurrent = await Promise.all([send(thread, 'Dos'), send(thread, 'Tres')]);
  expect(concurrent.map((r) => r.statusCode)).toEqual([200, 200]);
  const page = (await s1.http.call('GET', root + '/threads/' + thread + '/messages')).json();
  expect(page.messages.slice(-3).map((m: { seq: number }) => m.seq)).toEqual([
    sent.json().seq,
    sent.json().seq + 1,
    sent.json().seq + 2,
  ]);
  const last = page.thread.lastSeq;
  await s1.http.call('POST', root + '/threads/' + thread + '/read', { seq: last });
  await s1.http.call('POST', root + '/threads/' + thread + '/read', { seq: 0 });
  const after = (
    await s1.http.call('GET', root + '/threads/' + thread + '/messages?after=' + sent.json().seq)
  ).json();
  expect(after.messages).toHaveLength(2);
  expect(after.thread.readSeq).toBe(last);
  expect(after.thread.unread).toBe(0);
});
it('deduplicates notifications per thread and honors user preferences without losing unread messages', async () => {
  const first = await opened(),
    second = await opened(b.http, s1.id, b.userId);
  await send(first, 'Aviso uno');
  await send(second, 'Aviso de otro profesional', b.http);
  const initial = (await s1.http.call('GET', root)).json();
  expect(initial.notifications.some((n: { threadId: string }) => n.threadId === first)).toBe(true);
  expect(initial.notifications.some((n: { threadId: string }) => n.threadId === second)).toBe(true);
  const prefs = initial.preferences,
    r = await s1.http.call('PUT', root + '/preferences', { ...prefs, message: false });
  expect(r.statusCode, r.body).toBe(200);
  await send(first, 'Silenciado por preferencia');
  expect((await s1.http.call('GET', root)).json().notifications.length).toBe(
    initial.notifications.length,
  );
  const updated = (await s1.http.call('GET', root)).json().preferences;
  await s1.http.call('PUT', root + '/preferences', { ...updated, message: true });
});
it('authenticates sockets and invalidates after commit, rechecking revoked links', async () => {
  const thread = await opened(b.http, s1.id, b.userId);
  const socket = await server.injectWS(root + '/threads/' + thread + '/socket', {
    headers: { cookie: b.http.cookies, origin: 'http://localhost:5173' },
  });
  function message() {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Missing websocket event')), 4000);
      socket.once('message', (value) => {
        clearTimeout(timer);
        resolve(value.toString());
      });
    });
  }
  try {
    const next = message();
    const sent = await send(thread, 'Persistido antes del aviso', b.http);
    expect(sent.statusCode, sent.body).toBe(200);
    expect(JSON.parse(await next).type).toBe('invalidate');
    expect(
      (await s1.http.call('GET', root + '/threads/' + thread + '/messages'))
        .json()
        .messages.some((m: { id: string }) => m.id === sent.json().id),
    ).toBe(true);
    const closed = new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Missing revoked socket close')), 4000);
      socket.once('close', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });
    await admin.query(
      'DELETE FROM student_professionals WHERE organization_id=$1 AND student_id=$2 AND professional_user_id=$3',
      [a.id, s1.id, b.userId],
    );
    await admin.query("SELECT pg_notify('forma_followup',$1)", [
      JSON.stringify({ threadId: thread }),
    ]);
    expect(await closed).toBe(1008);
  } finally {
    socket.terminate();
    await admin.query(
      'INSERT INTO student_professionals(organization_id,student_id,professional_user_id)VALUES($1,$2,$3)ON CONFLICT DO NOTHING',
      [a.id, s1.id, b.userId],
    );
  }
});
it('processes one private pupil image, blocks library reuse, and revokes file access', async () => {
  const thread = await opened(),
    bytes = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#426547' } })
      .png()
      .toBuffer();
  const reserve = await s1.http.call('POST', root + '/threads/' + thread + '/attachments', {
    requestId: randomUUID(),
    kind: 'image',
    name: 'Imagen sintética.png',
    bytes: bytes.length,
    versionId: null,
  });
  expect(reserve.statusCode, reserve.body).toBe(200);
  const id = reserve.json().id;
  expect((await s2.http.call('GET', root + '/attachments/' + id)).statusCode).toBe(404);
  const upload = await s1.http.call('PUT', root + '/attachments/' + id + '/upload', bytes, {
    'content-type': 'application/octet-stream',
  });
  expect(upload.statusCode, upload.body).toBe(200);
  const job = await claimMediaJob(worker, [a.id]);
  expect(job).toBeTruthy();
  expect(
    await processMediaJob(worker, job!, {
      storageRoot: directory,
      engineVersion: 'targeted-image-test',
    }),
  ).toBe(true);
  const mediaId = (await admin.query('SELECT media_id FROM followup_attachments WHERE id=$1', [id]))
    .rows[0].media_id;
  expect(
    (await a.http.call('GET', `/v1/organizations/${a.id}/media/${mediaId}/file`)).statusCode,
  ).toBe(404);
  const sent = await send(thread, 'Imagen de seguimiento', s1.http, randomUUID(), [id]);
  expect(sent.statusCode, sent.body).toBe(200);
  const file = await a.http.call('GET', root + '/attachments/' + id + '/file');
  expect(file.statusCode, file.body).toBe(200);
  expect(file.headers['content-type']).toContain('image/webp');
  expect(
    (
      await a.http.call('GET', root + '/attachments/' + id + '/file', undefined, {
        range: 'bytes=0-9',
      })
    ).statusCode,
  ).toBe(206);
  await s1.http.call('POST', root + '/messages/' + sent.json().id + '/withdraw');
  expect((await a.http.call('GET', root + '/attachments/' + id + '/file')).statusCode).toBe(404);
  expect(
    (
      await send(
        thread,
        'Imagen de seguimiento',
        s1.http,
        (await admin.query('SELECT client_id FROM followup_messages WHERE id=$1', [sent.json().id]))
          .rows[0].client_id,
        [id],
      )
    ).json().id,
  ).toBe(sent.json().id);
});
it('requires separate consent, preserves null and zero, and rejects stale habit edits', async () => {
  const thread = await opened();
  await currentConsent(thread, false);
  const id = randomUUID(),
    assign = await a.http.call('POST', root + '/threads/' + thread + '/habits', {
      id,
      document: {
        name: 'Agua opcional',
        kind: 'water',
        target: null,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        instructions: '',
      },
      startsOn: today,
      endsOn: today,
    });
  expect(assign.statusCode, assign.body).toBe(200);
  const payload = { day: today, value: 0, note: '', revision: 0, requestId: randomUUID() };
  expect((await s1.http.call('PUT', root + '/habits/' + id + '/entry', payload)).statusCode).toBe(
    403,
  );
  await currentConsent(thread);
  expect((await s1.http.call('PUT', root + '/habits/' + id + '/entry', payload)).statusCode).toBe(
    200,
  );
  expect((await s1.http.call('PUT', root + '/habits/' + id + '/entry', payload)).statusCode).toBe(
    200,
  );
  expect(
    (
      await s1.http.call('PUT', root + '/habits/' + id + '/entry', {
        ...payload,
        value: 2,
        requestId: randomUUID(),
      })
    ).statusCode,
  ).toBe(409);
  const updated = await s1.http.call('PUT', root + '/habits/' + id + '/entry', {
    ...payload,
    value: null,
    revision: 1,
    requestId: randomUUID(),
  });
  expect(updated.statusCode, updated.body).toBe(200);
  const tracking = (await a.http.call('GET', root + '/threads/' + thread + '/tracking')).json();
  expect(tracking.entries.find((e: { habitId: string }) => e.habitId === id).value).toBeNull();
  await currentConsent(thread, false);
  expect(
    (await a.http.call('GET', root + '/threads/' + thread + '/tracking')).json().entries,
  ).toHaveLength(0);
  expect(
    (await s1.http.call('GET', root + '/threads/' + thread + '/tracking'))
      .json()
      .entries.some((e: { habitId: string }) => e.habitId === id),
  ).toBe(true);
});
async function form(thread: string) {
  const id = randomUUID(),
    yes = randomUUID(),
    numeric = randomUUID(),
    doc = {
      name: 'Revisión semanal',
      description: 'Formulario sintético',
      fields: [
        {
          id: yes,
          label: 'Realizado',
          type: 'boolean',
          required: true,
          min: null,
          max: null,
          options: [],
          unit: '',
        },
        {
          id: numeric,
          label: 'Valor opcional',
          type: 'number',
          required: false,
          min: 0,
          max: 10,
          options: [],
          unit: 'unidad',
        },
      ],
    };
  const save = await a.http.call('PUT', root + '/templates/' + id, { revision: 0, document: doc });
  expect(save.statusCode, save.body).toBe(200);
  const published = await a.http.call('POST', root + '/templates/' + id + '/publish', {
    revision: 1,
  });
  expect(published.statusCode, published.body).toBe(200);
  const version = published.json().id;
  expect(
    (await a.http.call('POST', root + '/templates/' + id + '/publish', { revision: 1 })).json().id,
  ).toBe(version);
  await expect(
    admin.query("UPDATE followup_checkin_versions SET document='{}' WHERE id=$1", [version]),
  ).rejects.toMatchObject({ message: 'IMMUTABLE_VERSION' });
  const assigned = await a.http.call('POST', root + '/threads/' + thread + '/schedules', {
    id: randomUUID(),
    versionId: version,
    frequency: 'weekly',
    weekday: new Date(today + 'T12:00:00Z').getUTCDay() || 7,
    monthDay: 31,
    windowDays: 7,
    startsOn: today,
    endsOn: today,
  });
  expect(assigned.statusCode, assigned.body).toBe(200);
  const schedule = assigned.json().id;
  const task = (await s1.http.call('GET', root + '/threads/' + thread + '/tracking'))
    .json()
    .tasks.find((t: { scheduleId: string }) => t.scheduleId === schedule);
  expect(task).toBeTruthy();
  return { id, version, task, yes, numeric };
}
it('freezes check-in versions, records false and zero once, reviews and locks editing', async () => {
  const thread = await opened();
  await currentConsent(thread);
  const f = await form(thread),
    payload = {
      revision: 0,
      requestId: randomUUID(),
      answers: { [f.yes]: false, [f.numeric]: 0 },
      declined: false,
    };
  const response = await s1.http.call('PUT', root + '/tasks/' + f.task.id + '/response', payload);
  expect(response.statusCode, response.body).toBe(200);
  expect(
    (await s1.http.call('PUT', root + '/tasks/' + f.task.id + '/response', payload)).json().id,
  ).toBe(response.json().id);
  const state = (await a.http.call('GET', root + '/threads/' + thread + '/tracking')).json();
  expect(state.tasks.find((t: { id: string }) => t.id === f.task.id).response.answers).toEqual(
    payload.answers,
  );
  const review = { requestId: randomUUID(), review: 'Gracias por compartir tu semana.' };
  expect(
    (await a.http.call('POST', root + '/responses/' + response.json().id + '/review', review))
      .statusCode,
  ).toBe(200);
  expect(
    (await a.http.call('POST', root + '/responses/' + response.json().id + '/review', review))
      .statusCode,
  ).toBe(200);
  expect(
    (
      await s1.http.call('PUT', root + '/tasks/' + f.task.id + '/response', {
        ...payload,
        revision: 1,
        requestId: randomUUID(),
      })
    ).statusCode,
  ).toBe(409);
});
it('deduplicates due notices, rejects late answers and allows voluntary decline without consent', async () => {
  const thread = await opened(),
    f = await form(thread);
  await worker.query('SELECT app.followup_schedule_tick()');
  const count = (
    await admin.query(
      'SELECT count(*)::int n FROM followup_notifications WHERE event_key LIKE $1',
      ['%due:' + f.task.id],
    )
  ).rows[0].n;
  await worker.query('SELECT app.followup_schedule_tick()');
  expect(
    (
      await admin.query(
        'SELECT count(*)::int n FROM followup_notifications WHERE event_key LIKE $1',
        ['%due:' + f.task.id],
      )
    ).rows[0].n,
  ).toBe(count);
  await currentConsent(thread, false);
  const payload = { revision: 0, requestId: randomUUID(), answers: {}, declined: true };
  const declined = await s1.http.call('PUT', root + '/tasks/' + f.task.id + '/response', payload);
  expect(declined.statusCode, declined.body).toBe(200);
  await admin.query(
    'UPDATE followup_checkin_tasks SET scheduled_on=$2::date-7,closes_on=$2::date-1 WHERE id=$1',
    [f.task.id, today],
  );
  expect(
    (
      await s1.http.call('PUT', root + '/tasks/' + f.task.id + '/response', {
        ...payload,
        revision: 1,
        requestId: randomUUID(),
      })
    ).statusCode,
  ).toBe(409);
});
it('expires old content and fails closed when PDF scanning is not configured', async () => {
  const thread = await opened(),
    sent = await send(thread, 'Contenido de retención sintético');
  await admin.query(
    "UPDATE followup_messages SET created_at=now()-interval '181 days' WHERE id=$1",
    [sent.json().id],
  );
  expect(
    (await s1.http.call('GET', root + '/threads/' + thread + '/messages'))
      .json()
      .messages.some((m: { id: string }) => m.id === sent.json().id),
  ).toBe(false);
  await worker.query('SELECT app.media_maintenance()');
  expect(
    (
      await admin.query('SELECT body,withdrawn_at FROM followup_messages WHERE id=$1', [
        sent.json().id,
      ])
    ).rows[0].body,
  ).toBe('');
  const oldHost = process.env.CLAMAV_HOST;
  delete process.env.CLAMAV_HOST;
  try {
    expect(
      (
        await s1.http.call('POST', root + '/threads/' + thread + '/attachments', {
          requestId: randomUUID(),
          kind: 'pdf',
          name: 'Prueba.pdf',
          bytes: 50,
          versionId: null,
        })
      ).statusCode,
    ).toBe(503);
  } finally {
    if (oldHost) process.env.CLAMAV_HOST = oldHost;
  }
  const privileges = await api.query(
    "SELECT has_table_privilege(current_user,'followup_messages','INSERT') allowed,has_function_privilege(current_user,'app.followup_wake(uuid)','EXECUTE') wake",
  );
  expect(privileges.rows[0]).toEqual({ allowed: false, wake: false });
});
it('revalidates explicitly shared T08 resources on each download and rejects another conversation', async () => {
  const thread = await opened(),
    storage = new PrivateStorage(directory),
    bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#334455' } })
      .webp()
      .toBuffer(),
    key = await storage.put(bytes, 'webp');
  const media = (
    await admin.query(
      "INSERT INTO media_assets(organization_id,created_by,request_id,kind,state,declared_bytes,reserved_bytes,output_key,output_bytes,mime_type)VALUES($1,$2,$3,'image','ready',$4::integer,0,$5,$4::integer,'image/webp')RETURNING id",
      [a.id, a.userId, randomUUID(), bytes.length, key],
    )
  ).rows[0].id;
  const resource = (
      await admin.query(
        "INSERT INTO private_resources(organization_id,request_id,name,created_by)VALUES($1,$2,'Recurso sintético',$3)RETURNING id",
        [a.id, randomUUID(), a.userId],
      )
    ).rows[0].id,
    version = (
      await admin.query(
        "INSERT INTO resource_versions(organization_id,resource_id,request_id,number,kind,state,media_id,created_by)VALUES($1,$2,$3,1,'media','ready',$4,$5)RETURNING id",
        [a.id, resource, randomUUID(), media, a.userId],
      )
    ).rows[0].id;
  await admin.query(
    'INSERT INTO resource_student_access(organization_id,resource_id,student_id,granted_by)VALUES($1,$2,$3,$4)',
    [a.id, resource, s1.id, a.userId],
  );
  const reserve = await a.http.call('POST', root + '/threads/' + thread + '/attachments', {
    requestId: randomUUID(),
    kind: 'resource',
    name: 'Recurso compartido',
    bytes: 0,
    versionId: version,
  });
  expect(reserve.statusCode, reserve.body).toBe(200);
  const id = reserve.json().id;
  expect((await send(thread, 'Referencia compartida', a.http, randomUUID(), [id])).statusCode).toBe(
    200,
  );
  expect((await s1.http.call('GET', root + '/attachments/' + id + '/file')).statusCode).toBe(200);
  const other = await opened(b.http, s1.id, b.userId);
  expect(
    (
      await b.http.call('POST', root + '/threads/' + other + '/attachments', {
        requestId: randomUUID(),
        kind: 'resource',
        name: 'Intento',
        bytes: 0,
        versionId: version,
      })
    ).statusCode,
  ).toBe(400);
  await admin.query('DELETE FROM resource_student_access WHERE resource_id=$1', [resource]);
  expect((await s1.http.call('GET', root + '/attachments/' + id + '/file')).statusCode).toBe(404);
});
it('normalizes one tiny audio and one tiny video sequentially inside the shared quota', async () => {
  const thread = await opened();
  for (const kind of ['audio', 'video'] as const) {
    const path = join(directory, kind === 'audio' ? 'tiny.wav' : 'tiny.mp4');
    try {
      await runMediaCommand(
        process.env.FFMPEG_PATH ?? 'ffmpeg',
        kind === 'audio'
          ? [
              '-v',
              'error',
              '-y',
              '-f',
              'lavfi',
              '-i',
              'sine=frequency=440:duration=0.2',
              '-threads',
              '1',
              path,
            ]
          : [
              '-v',
              'error',
              '-y',
              '-f',
              'lavfi',
              '-i',
              'color=c=blue:s=160x90:d=0.2',
              '-threads',
              '1',
              '-c:v',
              'libx264',
              '-pix_fmt',
              'yuv420p',
              path,
            ],
        10000,
      );
      const bytes = await readFile(path),
        reserve = await s1.http.call('POST', root + '/threads/' + thread + '/attachments', {
          requestId: randomUUID(),
          kind,
          name: kind + ' sintético',
          bytes: bytes.length,
          versionId: null,
        });
      expect(reserve.statusCode, reserve.body).toBe(200);
      const id = reserve.json().id;
      expect(
        (
          await s1.http.call('PUT', root + '/attachments/' + id + '/upload', bytes, {
            'content-type': 'application/octet-stream',
          })
        ).statusCode,
      ).toBe(200);
      const job = await claimMediaJob(worker, [a.id]);
      expect(
        await processMediaJob(worker, job!, {
          storageRoot: directory,
          engineVersion: 'targeted-ffmpeg',
        }),
      ).toBe(true);
      const ready = (await s1.http.call('GET', root + '/attachments/' + id)).json();
      expect(ready.mimeType).toBe(kind + '/mp4');
      expect(ready.bytes).toBeGreaterThan(0);
      expect((await send(thread, kind + ' breve', s1.http, randomUUID(), [id])).statusCode).toBe(
        200,
      );
    } finally {
      await unlink(path).catch(() => {});
    }
  }
});
