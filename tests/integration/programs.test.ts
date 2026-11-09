import { approveFixtureCoach } from '../helpers/coach-approval.js';
import 'dotenv/config';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { buildApp } from '../../apps/api/src/app.js';
import { actorTransaction } from '../../apps/api/src/organizations.js';
import { claimMediaJob, processMediaJob } from '../../apps/worker/src/media.js';
import { maintainMedia } from '../../apps/worker/src/media-maintenance.js';
import { isolatedDatabase } from '../helpers/database.js';
import {
  freshSet,
  cloneWeek,
  dateAt,
  type ProgramDocument,
  type TrainingProgram,
  type ProgramVersion,
  type ProgramAssignment,
} from '@forma/shared';
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
  s3: Awaited<ReturnType<typeof pupil>>;
let root: string,
  exerciseId: string,
  equipmentId: string,
  mediaId: string,
  program: TrainingProgram,
  v1: ProgramVersion,
  v2: ProgramVersion,
  assignments: ProgramAssignment[];
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
function draft(weeks = 1): ProgramDocument {
  const week = {
    id: randomUUID(),
    name: 'Semana 1',
    days: [
      {
        id: randomUUID(),
        name: 'Fuerza',
        weekday: 1,
        notes: 'Con control',
        exercises: [
          {
            id: randomUUID(),
            exerciseId,
            notes: 'Sin prisa',
            sets: [{ ...freshSet(), weightKg: 40 }],
          },
        ],
      },
    ],
  };
  return {
    name: 'Fuerza ocho semanas',
    description: 'Plan original del coach',
    isTemplate: true,
    weeks: [
      week,
      ...Array.from({ length: weeks - 1 }, (_, i) => ({
        ...cloneWeek(week),
        name: `Semana ${i + 2}`,
      })),
    ],
  };
}
beforeAll(async () => {
  directory = await fixture.create();
  server = await buildApp({
    origin: 'http://127.0.0.1:5173',
    cookieSecret: 'program-tests-cookie-secret-at-least-32',
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    storageRoot: directory,
    developmentMailbox: true,
  });
  a = await coach('alpha');
  b = await coach('beta');
  s1 = await pupil(a, 'Alumna Uno');
  s2 = await pupil(a, 'Alumno Dos');
  s3 = await pupil(a, 'Alumno Tres');
  root = `/v1/organizations/${a.id}`;
  const picture = await sharp({
    create: { width: 64, height: 64, channels: 3, background: '#005ea8' },
  })
    .png()
    .toBuffer();
  const reservation = await a.http.call('POST', root + '/media/uploads', {
    kind: 'image',
    bytes: picture.length,
    requestId: randomUUID(),
  });
  expect(reservation.statusCode, reservation.body).toBe(201);
  mediaId = reservation.json().media.id;
  const received = await a.http.call('PUT', root + `/media/${mediaId}/content`, picture, {
    'content-type': 'application/octet-stream',
  });
  expect(received.statusCode, received.body).toBe(202);
  const job = await claimMediaJob(worker, [a.id]);
  expect(job).toBeDefined();
  expect(await processMediaJob(worker, job!, { storageRoot: directory })).toBe(true);
  equipmentId = (
    await a.http.call('POST', root + '/equipment', {
      name: 'Polea original',
      description: 'Material original',
      location: 'Sala A',
      state: 'available',
      photoId: mediaId,
    })
  ).json().equipment.id;
  const e = await a.http.call('POST', root + '/exercises', {
    name: 'Remo original',
    instructions: 'Instrucciones originales que deben permanecer en la versión uno.',
    muscle: 'Espalda',
    equipmentTag: 'Polea',
    metric: 'reps',
    variations: [],
    tags: ['Original'],
    state: 'published',
    equipmentId,
    mediaId,
  });
  expect(e.statusCode, e.body).toBe(201);
  exerciseId = e.json().exercise.id;
}, 30000);
afterAll(async () => {
  await server?.close();
  await api.end();
  await worker.end();
  await admin.end();
  await fixture.drop();
});
describe('T04 versioned training programs', () => {
  it('publishes a compact eight-week draft with full repeated instructions beyond the draft byte budget', async () => {
    const created = await a.http.call('POST', root + '/exercises', {
      name: 'Guía extensa de prueba',
      instructions: 'Indicaciones originales y controladas del coach. '.repeat(95),
      muscle: 'General',
      equipmentTag: '',
      metric: 'reps',
      variations: [],
      tags: [],
      state: 'published',
      equipmentId: null,
      mediaId: null,
    });
    expect(created.statusCode, created.body).toBe(201);
    const id = created.json().exercise.id;
    const p = draft(8);
    p.name = 'Snapshot completo';
    for (const w of p.weeks)
      w.days[0]!.exercises = Array.from({ length: 7 }, () => ({
        id: randomUUID(),
        exerciseId: id,
        notes: '',
        sets: [freshSet()],
      }));
    const r = await a.http.call('POST', root + '/programs', { document: p });
    expect(r.statusCode, r.body).toBe(201);
    const result = await a.http.call('POST', root + `/programs/${r.json().program.id}/publish`, {
      revision: 1,
    });
    expect(result.statusCode, result.body).toBe(200);
    const bytes = Buffer.byteLength(JSON.stringify(result.json().version.snapshot));
    expect(bytes).toBeGreaterThan(220000);
    expect(bytes).toBeLessThanOrEqual(2000000);
  });
  it('validates draft structure and numeric bounds even for SQL writes by the API role', async () => {
    const invalid = { name: 'Documento mal formado', weeks: [] };
    await expect(
      actorTransaction(api, a.userId, a.id, (db) =>
        db.query(
          'INSERT INTO training_programs(organization_id,document,created_by)VALUES($1,$2,$3)',
          [a.id, JSON.stringify(invalid), a.userId],
        ),
      ),
    ).rejects.toThrow('INVALID_PROGRAM');
    const p = draft();
    p.weeks[0]!.days[0]!.exercises[0]!.sets[0]!.restSeconds = 1.5;
    await expect(
      actorTransaction(api, a.userId, a.id, (db) =>
        db.query(
          'INSERT INTO training_programs(organization_id,document,created_by)VALUES($1,$2,$3)',
          [a.id, JSON.stringify(p), a.userId],
        ),
      ),
    ).rejects.toThrow('INVALID_PROGRAM');
  });
  it('publishes time and distance targets and rejects a missing metric-specific target', async () => {
    const p = draft(),
      day = p.weeks[0]!.days[0]!;
    p.name = 'Tiempo y distancia';
    day.exercises = [
      {
        id: randomUUID(),
        exerciseId: '61000000-0000-4000-8000-000000000003',
        notes: '',
        sets: [freshSet('time')],
      },
      {
        id: randomUUID(),
        exerciseId: '61000000-0000-4000-8000-000000000004',
        notes: '',
        sets: [freshSet('distance')],
      },
    ];
    const r = await a.http.call('POST', root + '/programs', { document: p });
    expect(r.statusCode, r.body).toBe(201);
    const id = r.json().program.id;
    const published = await a.http.call('POST', root + `/programs/${id}/publish`, { revision: 1 });
    expect(published.statusCode, published.body).toBe(200);
    expect(published.json().version.snapshot.weeks[0].days[0].exercises[0].sets[0].seconds).toBe(
      30,
    );
    day.exercises[0]!.sets[0]!.seconds = null;
    expect(
      published.json().version.snapshot.weeks[0].days[0].exercises[0].sets[0].weightKg,
    ).toBeNull();
    expect(published.json().version.snapshot.weeks[0].days[0].exercises[0].sets[0].rpe).toBeNull();
    expect(
      (await a.http.call('PUT', root + `/programs/${id}`, { document: p, revision: 1 })).statusCode,
    ).toBe(200);
    expect(
      (await a.http.call('POST', root + `/programs/${id}/publish`, { revision: 2 })).json().code,
    ).toBe('INVALID_PROGRAM');
  });
  it('creates bounded drafts, filters templates, copies and protects stale updates and other tenants', async () => {
    const r = await a.http.call('POST', root + '/programs', { document: draft(8) });
    expect(r.statusCode, r.body).toBe(201);
    program = r.json().program;
    expect(program.revision).toBe(1);
    expect(
      (await a.http.call('GET', root + '/programs?template=true&q=Fuerza')).json().programs,
    ).toHaveLength(1);
    expect((await b.http.call('GET', root + `/programs/${program.id}`)).statusCode).toBe(404);
    expect(
      (
        await a.http.call('PUT', root + `/programs/${program.id}`, {
          document: program.document,
          revision: 88,
        })
      ).statusCode,
    ).toBe(409);
    const copied = await a.http.call('POST', root + `/programs/${program.id}/copy`, {
      versionId: null,
    });
    expect(copied.statusCode).toBe(201);
    const p = copied.json().program;
    expect(
      (
        await a.http.call('POST', root + `/programs/${p.id}/archive`, {
          revision: p.revision,
          archived: true,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await a.http.call('GET', root + '/programs?archived=true')).json().programs,
    ).toHaveLength(1);
    expect(
      (await a.http.call('PUT', root + `/programs/${p.id}`, { document: p.document, revision: 2 }))
        .statusCode,
    ).toBe(409);
  });
  it('rejects duplicate ids, invalid units, empty publication and foreign exercise references', async () => {
    const raw = JSON.parse(JSON.stringify(draft()));
    raw.weeks[0].days[0].exercises[0].sets[0].restSeconds = null;
    expect((await a.http.call('POST', root + '/programs', { document: raw })).statusCode).toBe(400);
    const bad = draft();
    bad.weeks[0]!.days[0]!.exercises[0]!.sets[0]!.repsMin = 50;
    expect((await a.http.call('POST', root + '/programs', { document: bad })).statusCode).toBe(400);
    const duplicate = draft();
    duplicate.weeks[0]!.days[0]!.id = duplicate.weeks[0]!.id;
    expect(
      (await a.http.call('POST', root + '/programs', { document: duplicate })).statusCode,
    ).toBe(400);
    const empty = draft();
    empty.weeks[0]!.days = [];
    const created = (await a.http.call('POST', root + '/programs', { document: empty })).json()
      .program;
    expect(
      (await a.http.call('POST', root + `/programs/${created.id}/publish`, { revision: 1 }))
        .statusCode,
    ).toBe(400);
    const foreign = draft();
    foreign.weeks[0]!.days[0]!.exercises[0]!.exerciseId = randomUUID();
    expect(
      (await a.http.call('POST', root + '/programs/preview', { document: foreign })).json().code,
    ).toBe('INVALID_REFERENCE');
  });
  it('previews the current library without creating a published version', async () => {
    const r = await a.http.call('POST', root + '/programs/preview', { document: program.document });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().snapshot.weeks[0].days[0].exercises[0].snapshot.name).toBe('Remo original');
    expect(
      (
        await admin.query('SELECT count(*)::int n FROM program_versions WHERE program_id=$1', [
          program.id,
        ])
      ).rows[0].n,
    ).toBe(0);
  });
  it('publishes exactly once under contention and enforces immutable snapshots and media references in SQL', async () => {
    const results = await Promise.all([
      a.http.call('POST', root + `/programs/${program.id}/publish`, { revision: 1 }),
      a.http.call('POST', root + `/programs/${program.id}/publish`, { revision: 1 }),
    ]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(results[0]!.json().version.id).toBe(results[1]!.json().version.id);
    v1 = results[0]!.json().version;
    expect(v1.number).toBe(1);
    expect(v1.snapshot.weeks).toHaveLength(8);
    await expect(
      admin.query("UPDATE program_versions SET snapshot='{}' WHERE id=$1", [v1.id]),
    ).rejects.toThrow('IMMUTABLE_VERSION');
    await expect(admin.query('DELETE FROM program_versions WHERE id=$1', [v1.id])).rejects.toThrow(
      'IMMUTABLE_VERSION',
    );
    await expect(
      admin.query('DELETE FROM program_version_media WHERE version_id=$1', [v1.id]),
    ).rejects.toThrow('IMMUTABLE_VERSION');
    await expect(
      actorTransaction(api, a.userId, a.id, (db) =>
        db.query(
          'INSERT INTO program_versions(organization_id,program_id,number,source_revision,snapshot,created_by)VALUES($1,$2,99,99,$3,$4)',
          [a.id, program.id, '{}', a.userId],
        ),
      ),
    ).rejects.toThrow();
  });
  it('assigns one exact eight-week version to two active students atomically and idempotently', async () => {
    const requestId = randomUUID(),
      body = { studentIds: [s1.id, s2.id], startsOn: today(), requestId };
    const r = await a.http.call('POST', root + `/program-versions/${v1.id}/assignments`, body);
    expect(r.statusCode, r.body).toBe(201);
    assignments = r.json().assignments;
    expect(assignments).toHaveLength(2);
    expect(assignments[0]!.endsOn).toBe(dateAt(today(), 55));
    const retry = await a.http.call('POST', root + `/program-versions/${v1.id}/assignments`, {
      ...body,
      studentIds: [s2.id, s1.id],
    });
    expect(retry.json().assignments.map((a: ProgramAssignment) => a.id)).toEqual(
      assignments.map((a) => a.id),
    );
    expect(
      (
        await a.http.call('POST', root + `/program-versions/${v1.id}/assignments`, {
          ...body,
          startsOn: dateAt(today(), 1),
        })
      ).json().code,
    ).toBe('IDEMPOTENCY_CONFLICT');
  });
  it('retains v1 instructions, equipment, media and targets when library and draft change and v2 is published', async () => {
    const current = (await a.http.call('GET', root + `/exercises/${exerciseId}`)).json().exercise;
    const e = await a.http.call('PUT', root + `/exercises/${exerciseId}`, {
      name: 'Remo cambiado',
      instructions: 'Instrucciones nuevas que no deben reemplazar las históricas.',
      muscle: 'Espalda',
      equipmentTag: 'Polea',
      metric: 'reps',
      variations: [],
      tags: ['Nueva'],
      state: 'published',
      equipmentId: null,
      mediaId: null,
      version: current.version,
    });
    expect(e.statusCode, e.body).toBe(200);
    await a.http.call('PUT', root + `/equipment/${equipmentId}`, {
      name: 'Polea nueva',
      description: 'Nuevo equipo',
      location: 'Sala B',
      state: 'maintenance',
      photoId: null,
      version: 1,
    });
    const doc = structuredClone(program.document);
    doc.weeks[0]!.days[0]!.exercises[0]!.sets[0]!.weightKg = 65;
    const saved = await a.http.call('PUT', root + `/programs/${program.id}`, {
      document: doc,
      revision: 1,
    });
    expect(saved.statusCode).toBe(200);
    program = saved.json().program;
    const published = await a.http.call('POST', root + `/programs/${program.id}/publish`, {
      revision: 2,
    });
    expect(published.statusCode, published.body).toBe(200);
    v2 = published.json().version;
    expect(v2.number).toBe(2);
    const old = (await a.http.call('GET', root + `/program-versions/${v1.id}`)).json().version;
    expect(old.snapshot.weeks[0].days[0].exercises[0].snapshot.name).toBe('Remo original');
    expect(old.snapshot.weeks[0].days[0].exercises[0].snapshot.equipment.location).toBe('Sala A');
    expect(old.snapshot.weeks[0].days[0].exercises[0].sets[0].weightKg).toBe(40);
    expect(v2.snapshot.weeks[0]!.days[0]!.exercises[0]!.sets[0]!.weightKg).toBe(65);
    expect(
      (await a.http.call('GET', root + '/program-assignments'))
        .json()
        .assignments.every((a: ProgramAssignment) => a.versionId === v1.id),
    ).toBe(true);
  });
  it('keeps snapshot media private and retained after live library associations are removed', async () => {
    const r = await a.http.call('POST', root + `/media/${mediaId}/delete`);
    expect(r.json().code, r.body).toBe('MEDIA_REFERENCED');
    await maintainMedia(worker, directory);
    expect((await s1.http.call('GET', root + `/media/${mediaId}/file`)).statusCode).toBe(200);
    expect((await b.http.call('GET', root + `/media/${mediaId}/file`)).statusCode).toBe(404);
    const keys = (await worker.query('SELECT app.media_storage_references() key')).rows.filter(
      (r) => r.key,
    );
    expect(keys.length).toBeGreaterThan(0);
  });
  it('exposes only assigned versions, not the whole private library or other students', async () => {
    expect((await s1.http.call('GET', root + `/program-versions/${v1.id}`)).statusCode).toBe(200);
    expect((await s1.http.call('GET', root + `/program-versions/${v2.id}`)).statusCode).toBe(404);
    expect((await s3.http.call('GET', root + `/program-versions/${v1.id}`)).statusCode).toBe(404);
    expect((await s1.http.call('GET', root + `/exercises/${exerciseId}`)).statusCode).toBe(404);
    expect(
      (await s1.http.call('GET', root + '/program-assignments'))
        .json()
        .assignments.map((a: ProgramAssignment) => a.studentId),
    ).toEqual([s1.id]);
    expect((await s1.http.call('GET', root + '/programs')).statusCode).toBe(403);
    const denied = await actorTransaction(api, s3.userId, a.id, (db) =>
      db.query('SELECT id FROM program_versions WHERE id=$1', [v1.id]),
    );
    expect(denied.rows).toEqual([]);
  });
  it('serializes overlapping assignments, rejects invalid dates and rolls back a mixed batch', async () => {
    const body = { studentIds: [s3.id], startsOn: today() };
    const results = await Promise.all([
      a.http.call('POST', root + `/program-versions/${v1.id}/assignments`, {
        ...body,
        requestId: randomUUID(),
      }),
      a.http.call('POST', root + `/program-versions/${v2.id}/assignments`, {
        ...body,
        requestId: randomUUID(),
      }),
    ]);
    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(results.filter((r) => r.json().code === 'ASSIGNMENT_OVERLAP')).toHaveLength(1);
    expect(
      (
        await a.http.call('POST', root + `/program-versions/${v2.id}/assignments`, {
          studentIds: [s1.id, randomUUID()],
          startsOn: dateAt(today(), 70),
          requestId: randomUUID(),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await a.http.call('POST', root + `/program-versions/${v2.id}/assignments`, {
          studentIds: [s1.id],
          startsOn: '2026-02-30',
          requestId: randomUUID(),
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await a.http.call('POST', root + `/program-versions/${v2.id}/assignments`, {
          studentIds: [s1.id],
          startsOn: dateAt(today(), 367),
          requestId: randomUUID(),
        })
      ).statusCode,
    ).toBe(400);
  });
  it('revokes version and media access when cancelling and preserves audit/history for the coach', async () => {
    const a1 = assignments.find((a) => a.studentId === s1.id)!;
    expect(
      (
        await a.http.call('POST', root + `/program-assignments/${a1.id}/cancel`, {
          revision: 99,
          reason: 'Cambio de plan',
        })
      ).statusCode,
    ).toBe(409);
    const r = await a.http.call('POST', root + `/program-assignments/${a1.id}/cancel`, {
      revision: 1,
      reason: 'Cambio de plan solicitado',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect((await s1.http.call('GET', root + `/program-versions/${v1.id}`)).statusCode).toBe(404);
    expect((await s1.http.call('GET', root + `/media/${mediaId}/file`)).statusCode).toBe(404);
    expect((await s2.http.call('GET', root + `/media/${mediaId}/file`)).statusCode).toBe(200);
    expect(
      (await a.http.call('GET', root + '/program-assignments?state=cancelled')).json()
        .assignments[0].cancellationReason,
    ).toBe('Cambio de plan solicitado');
  });
  it('restricts an assigned professional to managed students and denies assignment writes in raw SQL', async () => {
    const professional = await coach('professional');
    await admin.query(
      "INSERT INTO organization_memberships(organization_id,user_id,role)VALUES($1,$2,'coach')",
      [a.id, professional.userId],
    );
    await admin.query(
      'INSERT INTO student_professionals(organization_id,student_id,professional_user_id)VALUES($1,$2,$3)',
      [a.id, s1.id, professional.userId],
    );
    expect(
      (await professional.http.call('GET', root + '/program-assignments'))
        .json()
        .assignments.every((a: ProgramAssignment) => a.studentId === s1.id),
    ).toBe(true);
    expect(
      (
        await professional.http.call('POST', root + `/program-versions/${v2.id}/assignments`, {
          studentIds: [s2.id],
          startsOn: dateAt(today(), 70),
          requestId: randomUUID(),
        })
      ).statusCode,
    ).toBe(404);
    await expect(
      actorTransaction(api, a.userId, a.id, (db) =>
        db.query("UPDATE program_assignments SET state='cancelled'"),
      ),
    ).rejects.toThrow();
  });
  it('rejects a non-ready medium at preview/publication and preserves an assigned version when archiving its program', async () => {
    const p = draft();
    const reservation = (
      await a.http.call('POST', root + '/media/uploads', {
        kind: 'image',
        bytes: 10,
        requestId: randomUUID(),
      })
    ).json().media;
    await admin.query("UPDATE media_assets SET state='pending' WHERE id=$1", [reservation.id]);
    await admin.query('UPDATE exercises SET media_id=$1 WHERE id=$2', [reservation.id, exerciseId]);
    expect(
      (await a.http.call('POST', root + '/programs/preview', { document: p })).json().code,
    ).toBe('MEDIA_NOT_READY');
    const created = (await a.http.call('POST', root + '/programs', { document: p })).json().program;
    expect(
      (await a.http.call('POST', root + `/programs/${created.id}/publish`, { revision: 1 })).json()
        .code,
    ).toBe('MEDIA_NOT_READY');
    expect(
      (
        await a.http.call('POST', root + `/programs/${program.id}/archive`, {
          revision: program.revision,
          archived: true,
        })
      ).statusCode,
    ).toBe(200);
    expect((await s2.http.call('GET', root + `/program-versions/${v1.id}`)).statusCode).toBe(200);
  });
});

// T05 reuses the isolated T04 organization and private-media fixture.
let workout: import('@forma/shared').WorkoutSession;
let workoutVersion: ProgramVersion, workoutAssignment: ProgramAssignment;
const deviceId = randomUUID();
function intention(command: Record<string, unknown>, id: string = randomUUID()) {
  return {
    clientEventId: id,
    deviceId,
    command: {
      expectedRevision: workout?.revision ?? 0,
      clientOccurredAt: new Date().toISOString(),
      ...command,
    },
  };
}
async function send(command: Record<string, unknown>, eventId?: string) {
  const response = await s1.http.call(
    'POST',
    root + `/workouts/${workout.id}/events`,
    intention(command, eventId),
  );
  expect(response.statusCode, response.body).toBe(200);
  workout = response.json().session;
  return response.json().receipt;
}
describe('T05 executed sessions and immutable receipts', () => {
  it('prepares one immutable day and rejects distant dates, coaches and unknown references', async () => {
    await admin.query('UPDATE exercises SET media_id=$1 WHERE id=$2', [mediaId, exerciseId]);
    const document = draft(8);
    document.name = 'Entrenamiento ejecutable';
    document.weeks[0]!.days[0]!.exercises[0]!.sets.push({ ...freshSet(), weightKg: null });
    document.weeks[0]!.days.push({
      ...document.weeks[0]!.days[0]!,
      id: randomUUID(),
      weekday: 2,
      name: 'Segundo día',
      exercises: document.weeks[0]!.days[0]!.exercises.map((x) => ({
        ...x,
        id: randomUUID(),
        sets: x.sets.map((s) => ({ ...s, id: randomUUID() })),
      })),
    });
    const p = (await a.http.call('POST', root + '/programs', { document })).json().program;
    workoutVersion = (
      await a.http.call('POST', root + `/programs/${p.id}/publish`, { revision: 1 })
    ).json().version;
    workoutAssignment = (
      await a.http.call('POST', root + `/program-versions/${workoutVersion.id}/assignments`, {
        studentIds: [s1.id],
        startsOn: today(),
        requestId: randomUUID(),
      })
    ).json().assignments[0];
    const body = {
      assignmentId: workoutAssignment.id,
      weekId: document.weeks[0]!.id,
      dayId: document.weeks[0]!.days[0]!.id,
    };
    const responses = await Promise.all([
      s1.http.call('POST', root + '/workouts/prepare', body),
      s1.http.call('POST', root + '/workouts/prepare', body),
    ]);
    expect(responses[0]!.statusCode, responses[0]!.body).toBe(200);
    workout = responses[0]!.json().session;
    expect(responses[1]!.json().session.id).toBe(workout.id);
    expect(workout.sets).toHaveLength(2);
    expect(workout.sets[1]!.target.weightKg).toBeNull();
    expect((await a.http.call('POST', root + '/workouts/prepare', body)).statusCode).toBe(403);
    expect((await s2.http.call('POST', root + '/workouts/prepare', body)).statusCode).toBe(403);
    expect(
      (
        await s1.http.call('POST', root + '/workouts/prepare', {
          ...body,
          weekId: document.weeks[7]!.id,
          dayId: document.weeks[7]!.days[0]!.id,
        })
      ).json().code,
    ).toBe('WORKOUT_DATE');
  });
  it('replays a lost start response exactly once and refuses UUID reuse with another intent', async () => {
    const body = intention({ kind: 'session.start' });
    const responses = await Promise.all([
      s1.http.call('POST', root + `/workouts/${workout.id}/events`, body),
      s1.http.call('POST', root + `/workouts/${workout.id}/events`, body),
    ]);
    for (const r of responses) expect(r.statusCode, r.body).toBe(200);
    expect(responses[0]!.json().receipt).toEqual(responses[1]!.json().receipt);
    workout = responses[0]!.json().session;
    expect(workout.revision).toBe(1);
    const conflict = await s1.http.call('POST', root + `/workouts/${workout.id}/events`, {
      ...body,
      command: { ...body.command, kind: 'session.note', notes: 'Otro contenido' },
    });
    expect(conflict.json().code).toBe('IDEMPOTENCY_CONFLICT');
    expect(
      (await admin.query('SELECT count(*) FROM workout_events WHERE session_id=$1', [workout.id]))
        .rows[0].count,
    ).toBe('1');
  });
  it('serializes two devices on the same set and persists the rejected receipt', async () => {
    const s = workout.sets[0]!;
    const make = (reps: number) =>
      intention({
        kind: 'set.save',
        entryId: s.entryId,
        setId: s.setId,
        expectedRevision: 0,
        actual: { weightKg: 0, reps, seconds: null, distanceMeters: null, rpe: 7, note: 'Real' },
      });
    const e1 = make(8),
      e2 = make(9),
      responses = await Promise.all([
        s1.http.call('POST', root + `/workouts/${workout.id}/events`, e1),
        s1.http.call('POST', root + `/workouts/${workout.id}/events`, e2),
      ]);
    const accepted = responses.find((r) => r.json().receipt?.status === 'accepted')!,
      rejected = responses.find((r) => r.json().receipt?.status === 'rejected')!;
    expect(accepted, JSON.stringify(responses.map((r) => r.json()))).toBeDefined();
    expect(rejected.json().receipt.code).toBe('SET_CONFLICT');
    workout = (await s1.http.call('GET', root + `/workouts/${workout.id}`)).json().session;
    expect(workout.sets[0]!.revision).toBe(1);
    expect(workout.sets[0]!.actual.weightKg).toBe(0);
    const original = responses[0] === rejected ? e1 : e2;
    expect(
      (await s1.http.call('POST', root + `/workouts/${workout.id}/events`, original)).json()
        .receipt,
    ).toEqual(rejected.json().receipt);
  });
  it('allows independent set changes from stale global revisions and retains exact nulls', async () => {
    const s = workout.sets[1]!;
    const receipt = await send({
      kind: 'set.save',
      entryId: s.entryId,
      setId: s.setId,
      expectedRevision: 0,
      actual: {
        weightKg: null,
        reps: 12,
        seconds: null,
        distanceMeters: null,
        rpe: null,
        note: 'Sin carga prescrita',
      },
    });
    expect(receipt.status).toBe('accepted');
    expect(workout.sets[1]!.actual.weightKg).toBeNull();
    expect(workout.sets[1]!.target.weightKg).toBeNull();
  });
  it('rejects raw numeric strings, null required revisions and incompatible units before mutation', async () => {
    const s = workout.sets[0]!;
    const base = {
      kind: 'set.save',
      entryId: s.entryId,
      setId: s.setId,
      expectedRevision: s.revision,
      actual: { weightKg: null, reps: 8, seconds: null, distanceMeters: null, rpe: null, note: '' },
    };
    for (const extra of [
      { expectedRevision: null },
      { actual: { ...base.actual, reps: '8' } },
      { actual: { ...base.actual, weightKg: 1001 } },
    ])
      expect(
        (
          await s1.http.call(
            'POST',
            root + `/workouts/${workout.id}/events`,
            intention({ ...base, ...extra }),
          )
        ).statusCode,
      ).toBe(400);
    expect(
      (await send({ ...base, actual: { ...base.actual, reps: null, seconds: 20 } })).code,
    ).toBe('INVALID_WORKOUT');
  });
  it('undoes without deleting the event, requires partial confirmation and audits reopening', async () => {
    const s = workout.sets[1]!;
    expect(
      (
        await send({
          kind: 'set.undo',
          entryId: s.entryId,
          setId: s.setId,
          expectedRevision: s.revision,
        })
      ).status,
    ).toBe('accepted');
    expect(workout.sets[1]!.actual.reps).toBeNull();
    expect(
      (
        await send({
          kind: 'session.complete',
          notes: 'Parcial',
          durationSeconds: 200,
          allowPartial: false,
        })
      ).code,
    ).toBe('WORKOUT_INCOMPLETE');
    expect(
      (
        await send({
          kind: 'session.complete',
          notes: 'Buen control',
          durationSeconds: 200,
          allowPartial: true,
        })
      ).status,
    ).toBe('accepted');
    expect(workout.state).toBe('completed');
    expect(
      (
        await send({
          kind: 'set.undo',
          entryId: s.entryId,
          setId: s.setId,
          expectedRevision: workout.sets[1]!.revision,
        })
      ).code,
    ).toBe('WORKOUT_STATE');
    expect((await send({ kind: 'session.reopen', reason: 'Corregir repetición' })).status).toBe(
      'accepted',
    );
    expect(workout.durationSeconds).toBe(200);
    expect(
      (
        await send({
          kind: 'session.note',
          notes: 'Nota revisada',
          expectedRevision: workout.notesRevision,
        })
      ).status,
    ).toBe('accepted');
    const audit = await admin.query(
      "SELECT count(*) FROM audit_logs WHERE organization_id=$1 AND action='workout.session.reopen'",
      [a.id],
    );
    expect(audit.rows[0].count).toBe('1');
  });
  it('keeps snapshots immutable and isolates SQL reads, events and direct writes', async () => {
    expect((await s2.http.call('GET', root + `/workouts/${workout.id}`)).statusCode).toBe(404);
    expect((await b.http.call('GET', root + `/workouts/${workout.id}`)).statusCode).toBe(404);
    expect((await a.http.call('GET', root + `/workouts/${workout.id}`)).statusCode).toBe(200);
    expect(
      (
        await actorTransaction(api, s2.userId, a.id, (db) =>
          db.query('SELECT id FROM workout_sessions'),
        )
      ).rows,
    ).toEqual([]);
    await expect(
      actorTransaction(api, s1.userId, a.id, (db) => db.query('UPDATE workout_sets SET reps=500')),
    ).rejects.toThrow();
    await expect(
      admin.query("UPDATE workout_sessions SET program_name='Alterado' WHERE id=$1", [workout.id]),
    ).rejects.toThrow('IMMUTABLE_VERSION');
    await expect(
      admin.query('DELETE FROM workout_events WHERE session_id=$1', [workout.id]),
    ).rejects.toThrow('IMMUTABLE_EVENT');
    const summary = (await a.http.call('GET', root + `/workouts?studentId=${s1.id}`)).json()
      .sessions;
    expect(summary[0].sets[0].actual.weightKg).toBe(0);
    expect(summary[0].notes).toBe('Nota revisada');
    expect(summary[0].prescription.exercises[0].snapshot.name).toBe(
      workoutVersion.snapshot.weeks[0]!.days[0]!.exercises[0]!.snapshot!.name,
    );
  });
  it('serializes a reused UUID across two sessions and paginates ties without losing history', async () => {
    const w = workoutVersion.snapshot.weeks[0]!;
    const prepared = await s1.http.call('POST', root + '/workouts/prepare', {
      assignmentId: workoutAssignment.id,
      weekId: w.id,
      dayId: w.days[1]!.id,
    });
    expect(prepared.statusCode, prepared.body).toBe(200);
    const second = prepared.json().session;
    const e = intention({ kind: 'session.start', expectedRevision: 0 }),
      responses = await Promise.all([
        s1.http.call('POST', root + `/workouts/${workout.id}/events`, e),
        s1.http.call('POST', root + `/workouts/${second.id}/events`, e),
      ]);
    expect(responses.filter((r) => r.statusCode === 200)).toHaveLength(1);
    expect(responses.find((r) => r.statusCode === 409)?.json().code).toBe('IDEMPOTENCY_CONFLICT');
    await admin.query(
      'UPDATE workout_sessions SET created_at=(SELECT created_at FROM workout_sessions WHERE id=$1) WHERE id=$2',
      [workout.id, second.id],
    );
    const first = (await s1.http.call('GET', root + '/workouts?limit=1')).json(),
      next = (
        await s1.http.call('GET', root + `/workouts?limit=1&before=${first.nextBefore}`)
      ).json();
    expect(first.sessions).toHaveLength(1);
    expect(next.sessions).toHaveLength(1);
    expect(first.sessions[0].id).not.toBe(next.sessions[0].id);
  });
  it('retains own historical day media after cancellation, blocks pending writes and new days', async () => {
    const r = await a.http.call(
      'POST',
      root + `/program-assignments/${workoutAssignment.id}/cancel`,
      { revision: 1, reason: 'Pausa solicitada' },
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(
      (await s1.http.call('GET', root + `/program-versions/${workoutVersion.id}`)).statusCode,
    ).toBe(404);
    const historyRead = await s1.http.call('GET', root + `/workouts/${workout.id}`);
    expect(historyRead.statusCode, historyRead.body).toBe(200);
    const historyMedia = await s1.http.call('GET', root + `/media/${mediaId}/file`);
    expect(historyMedia.statusCode, historyMedia.body).toBe(200);
    expect(
      (
        await send({
          kind: 'session.note',
          notes: 'Pendiente al cancelar',
          expectedRevision: workout.notesRevision,
        })
      ).code,
    ).toBe('WORKOUT_ACCESS_REVOKED');
    const w = workoutVersion.snapshot.weeks[1]!;
    expect(
      (
        await s1.http.call('POST', root + '/workouts/prepare', {
          assignmentId: workoutAssignment.id,
          weekId: w.id,
          dayId: w.days[0]!.id,
        })
      ).json().code,
    ).toBe('WORKOUT_ACCESS_REVOKED');
  });
});
