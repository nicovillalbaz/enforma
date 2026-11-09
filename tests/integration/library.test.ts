import { approveFixtureCoach } from '../helpers/coach-approval.js';
import 'dotenv/config';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import pg from 'pg';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, utimes, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { buildApp } from '../../apps/api/src/app.js';
import { actorTransaction } from '../../apps/api/src/organizations.js';
import { migrate } from '../../packages/db/src/migrate.js';
import { claimMediaJob, processMediaJob, runMediaCommand } from '../../apps/worker/src/media.js';
import { maintainMedia } from '../../apps/worker/src/media-maintenance.js';
import type { MediaAsset, LibraryExercise } from '@forma/shared';

const testDatabase = 'forma_media_test_' + randomUUID().replaceAll('-', '');
const databaseUrl = (value: string | undefined) => {
  const url = new URL(value!);
  url.pathname = '/' + testDatabase;
  return url.toString();
};
const admin = new pg.Pool({ connectionString: databaseUrl(process.env.DATABASE_ADMIN_URL) });
const api = new pg.Pool({ connectionString: databaseUrl(process.env.DATABASE_URL) });
const worker = new pg.Pool({ connectionString: databaseUrl(process.env.WORKER_DATABASE_URL) });
let createdDatabase = false;
let server: Awaited<ReturnType<typeof buildApp>>;
let directory: string;
let image: Buffer;
let clip: Buffer;
let longClip: Buffer;
let clientNo = 1;
function client() {
  let cookie = '';
  let csrf = '';
  const ip = `127.0.2.${clientNo++}`;
  return {
    async call(
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      url: string,
      body?: unknown,
      extra: Record<string, string> = {},
    ) {
      if (!csrf) {
        const response = await server.inject({ url: '/v1/security/csrf', remoteAddress: ip });
        cookie = String(response.headers['set-cookie']).split(';')[0]!;
        csrf = response.json().token;
      }
      const response = await server.inject({
        method,
        url,
        remoteAddress: ip,
        headers: { cookie, 'x-csrf-token': csrf, ...extra },
        ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
      });
      const cookies = response.headers['set-cookie'];
      for (const value of cookies ? (Array.isArray(cookies) ? cookies : [cookies]) : []) {
        const pair = value.split(';')[0]!;
        const name = pair.split('=')[0]!;
        cookie = cookie
          .split('; ')
          .filter((item) => !item.startsWith(name + '='))
          .concat(pair)
          .join('; ');
      }
      return response;
    },
  };
}
async function coach(label: string) {
  const http = client();
  const suffix = randomUUID().slice(0, 8);
  const response = await http.call('POST', '/v1/auth/register-coach', {
    fullName: 'Coach Biblioteca',
    email: `${label}-${suffix}@example.test`,
    password: 'Library-password-2026!',
    name: `Biblioteca ${label}`,
    slug: `library-${label}-${suffix}`,
    kind: 'coach',
    accent: '#005ea8',
    plan: 'basic',
    privacyAccepted: true,
  });
  expect(response.statusCode, response.body).toBe(201);
  await approveFixtureCoach(admin, response.json().organizationId);
  const me = (await http.call('GET', '/v1/auth/me')).json().user;
  await admin.query('UPDATE app_users SET email_verified_at=now() WHERE id=$1', [me.id]);
  return { http, id: response.json().organizationId as string, userId: me.id as string };
}
type Coach = Awaited<ReturnType<typeof coach>>;
let a: Coach, b: Coach;
let exercise: LibraryExercise;
let picture: MediaAsset;
let movie: MediaAsset;
const exerciseBody = {
  name: 'Remo de estudio',
  instructions: 'Texto original para una guía de prueba con instrucciones del coach.',
  muscle: 'Espalda',
  equipmentTag: 'Polea',
  metric: 'reps',
  variations: ['Agarre neutro'],
  tags: ['Prueba'],
  state: 'draft',
  equipmentId: null,
  mediaId: null,
};
async function reserve(
  owner: Coach,
  kind: 'image' | 'video',
  bytes: number,
  requestId = randomUUID(),
) {
  return owner.http.call('POST', `/v1/organizations/${owner.id}/media/uploads`, {
    kind,
    bytes,
    requestId,
  });
}
async function upload(owner: Coach, kind: 'image' | 'video', bytes: Buffer) {
  const reserved = await reserve(owner, kind, bytes.length);
  expect(reserved.statusCode, reserved.body).toBe(201);
  const id = reserved.json().media.id as string;
  const response = await owner.http.call(
    'PUT',
    `/v1/organizations/${owner.id}/media/${id}/content`,
    bytes,
    { 'content-type': 'application/octet-stream' },
  );
  expect(response.statusCode, response.body).toBe(202);
  return response.json().media as MediaAsset;
}
async function processAsset(owner: Coach, asset: MediaAsset) {
  const job = await claimMediaJob(worker, [owner.id]);
  expect(job?.payload.mediaId).toBe(asset.id);
  expect(await processMediaJob(worker, job!, { storageRoot: directory })).toBe(true);
  return (await owner.http.call('GET', `/v1/organizations/${owner.id}/media/${asset.id}`)).json()
    .media as MediaAsset;
}
beforeAll(async () => {
  const manager = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
  await manager.connect();
  try {
    if (!/^forma_media_test_[a-f0-9]{32}$/.test(testDatabase))
      throw new Error('Invalid test database');
    await manager.query('CREATE DATABASE ' + testDatabase);
    createdDatabase = true;
  } finally {
    await manager.end();
  }
  await migrate(databaseUrl(process.env.DATABASE_ADMIN_URL));
  await mkdir('.local', { recursive: true });
  directory = await mkdtemp(join(resolve('.local'), 'library-test-'));
  server = await buildApp({
    origin: 'http://127.0.0.1:5173',
    cookieSecret: 'library-tests-cookie-secret-more-than-32',
    databaseUrl: databaseUrl(process.env.DATABASE_URL),
    storageRoot: directory,
    developmentMailbox: true,
  });
  a = await coach('alpha');
  b = await coach('beta');
  image = await sharp({ create: { width: 128, height: 96, channels: 3, background: '#19e7d0' } })
    .png()
    .toBuffer();
  for (const [name, duration] of [
    ['clip', 2],
    ['long', 61],
  ] as const) {
    await runMediaCommand(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-f',
        'lavfi',
        '-i',
        `color=c=blue:s=160x120:r=5:d=${duration}`,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-pix_fmt',
        'yuv420p',
        join(directory, `${name}.mp4`),
      ],
      15000,
    );
  }
  clip = await readFile(join(directory, 'clip.mp4'));
  longClip = await readFile(join(directory, 'long.mp4'));
}, 30000);
afterAll(async () => {
  await server?.close();
  await api.end();
  await worker.end();
  await admin.end();
  if (createdDatabase && /^forma_media_test_[a-f0-9]{32}$/.test(testDatabase)) {
    const manager = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
    await manager.connect();
    try {
      await manager.query('DROP DATABASE ' + testDatabase);
    } finally {
      await manager.end();
    }
  }
});

describe('T03 private library', () => {
  it('reads a global base, forbids global editing and isolates tenant CRUD, search and stale versions', async () => {
    const base = await a.http.call(
      'GET',
      `/v1/organizations/${a.id}/exercises?origin=global&limit=2`,
    );
    expect(base.json().exercises).toHaveLength(2);
    expect(base.json().nextCursor).toBeTruthy();
    const global = base.json().exercises[0];
    expect(
      (
        await a.http.call('PUT', `/v1/organizations/${a.id}/exercises/${global.id}`, {
          ...exerciseBody,
          version: 1,
        })
      ).statusCode,
    ).toBe(404);
    const created = await a.http.call('POST', `/v1/organizations/${a.id}/exercises`, exerciseBody);
    expect(created.statusCode, created.body).toBe(201);
    exercise = created.json().exercise;
    expect((await b.http.call('GET', `/v1/organizations/${a.id}/exercises`)).statusCode).toBe(404);
    expect(
      (await b.http.call('GET', `/v1/organizations/${b.id}/exercises/${exercise.id}`)).statusCode,
    ).toBe(404);
    expect(
      (
        await a.http.call(
          'GET',
          `/v1/organizations/${a.id}/exercises?q=Remo&origin=own&muscle=Espalda`,
        )
      )
        .json()
        .exercises.map((e: LibraryExercise) => e.id),
    ).toEqual([exercise.id]);
    const updated = await a.http.call('PUT', `/v1/organizations/${a.id}/exercises/${exercise.id}`, {
      ...exerciseBody,
      name: 'Remo actualizado',
      version: exercise.version,
    });
    expect(updated.statusCode).toBe(200);
    expect(
      (
        await a.http.call('PUT', `/v1/organizations/${a.id}/exercises/${exercise.id}`, {
          ...exerciseBody,
          version: exercise.version,
        })
      ).statusCode,
    ).toBe(409);
    exercise = updated.json().exercise;
    expect(
      await actorTransaction(
        api,
        b.userId,
        a.id,
        async (db) =>
          (await db.query('SELECT id FROM exercises WHERE organization_id=$1', [a.id])).rows,
      ),
    ).toEqual([]);
  });
  it('reserves idempotently, streams bytes once and normalizes an image in a claimed job', async () => {
    const requestId = randomUUID();
    const responses = await Promise.all([
      reserve(a, 'image', image.length, requestId),
      reserve(a, 'image', image.length, requestId),
    ]);
    expect(responses.every((r) => r.statusCode === 201)).toBe(true);
    expect(responses[0].json().media.id).toBe(responses[1].json().media.id);
    expect((await reserve(a, 'video', image.length, requestId)).statusCode).toBe(409);
    const id = responses[0].json().media.id as string;
    const loaded = await a.http.call(
      'PUT',
      `/v1/organizations/${a.id}/media/${id}/content`,
      image,
      { 'content-type': 'application/octet-stream' },
    );
    expect(loaded.statusCode, loaded.body).toBe(202);
    expect(
      (
        await a.http.call('PUT', `/v1/organizations/${a.id}/media/${id}/content`, image, {
          'content-type': 'application/octet-stream',
        })
      ).statusCode,
    ).toBe(409);
    picture = await processAsset(a, loaded.json().media);
    expect(picture).toMatchObject({ state: 'ready', kind: 'image', width: 128, height: 96 });
    const file = await a.http.call('GET', picture.url!);
    expect(file.headers['content-type']).toContain('image/webp');
    expect((await sharp(file.rawPayload).metadata()).format).toBe('webp');
    expect(JSON.stringify(picture)).not.toMatch(/input_key|output_key|inputHash|inputKey/);
    await expect(
      api.query("UPDATE media_assets SET state='ready' WHERE id=$1", [id]),
    ).rejects.toThrow();
  });
  it('links equipment and its photo only inside the organization', async () => {
    const created = await a.http.call('POST', `/v1/organizations/${a.id}/equipment`, {
      name: 'Polea del estudio',
      description: 'Equipo de prueba',
      location: 'Sala 1',
      state: 'available',
      photoId: picture.id,
    });
    expect(created.statusCode, created.body).toBe(201);
    const eq = created.json().equipment;
    expect(
      (
        await b.http.call('POST', `/v1/organizations/${b.id}/equipment`, {
          name: 'Ajeno',
          description: '',
          location: '',
          state: 'available',
          photoId: picture.id,
        })
      ).statusCode,
    ).toBe(400);
    const linked = await a.http.call('PUT', `/v1/organizations/${a.id}/exercises/${exercise.id}`, {
      ...exerciseBody,
      equipmentId: eq.id,
      mediaId: picture.id,
      version: exercise.version,
    });
    expect(linked.statusCode, linked.body).toBe(200);
    exercise = linked.json().exercise;
    expect(exercise.equipmentName).toBe('Polea del estudio');
    expect(
      (await a.http.call('POST', `/v1/organizations/${a.id}/media/${picture.id}/delete`)).json()
        .code,
    ).toBe('MEDIA_REFERENCED');
    await expect(
      actorTransaction(api, b.userId, b.id, (db) =>
        db.query('INSERT INTO equipment(organization_id,name,photo_id)VALUES($1,$2,$3)', [
          b.id,
          'Falso',
          picture.id,
        ]),
      ),
    ).rejects.toThrow();
  });
  it('creates a real MP4 and poster; streams byte ranges while denying another tenant', async () => {
    movie = await processAsset(a, await upload(a, 'video', clip));
    expect(movie).toMatchObject({ state: 'ready', kind: 'video', width: 160, height: 120 });
    expect(movie.durationSeconds).toBeCloseTo(2);
    expect(movie.processingMs).toBeGreaterThan(0);
    const first = await a.http.call('GET', movie.url!, undefined, { range: 'bytes=0-1' });
    expect(first.statusCode).toBe(206);
    expect(first.rawPayload).toHaveLength(2);
    expect(first.headers['content-range']).toMatch(/^bytes 0-1\//);
    expect(first.headers['cache-control']).toBe('private, no-store');
    expect(
      (await a.http.call('GET', movie.url!, undefined, { range: 'bytes=999999999-' })).statusCode,
    ).toBe(416);
    expect((await a.http.call('GET', movie.posterUrl!)).headers['content-type']).toContain(
      'image/jpeg',
    );
    expect(
      (await b.http.call('GET', `/v1/organizations/${b.id}/media/${movie.id}/file`)).statusCode,
    ).toBe(404);
    expect((await client().call('GET', movie.url!)).statusCode).toBe(401);
  });
  it('publishes a guide only to an explicitly authorized active student and revokes every subsequent file read', async () => {
    const email = `reader-${randomUUID()}@example.test`;
    const student = (
      await a.http.call('POST', `/v1/organizations/${a.id}/students`, {
        displayName: 'Alumno Biblioteca',
        email,
        goal: 'Practicar',
      })
    ).json().student;
    const invitation = await a.http.call(
      'POST',
      `/v1/organizations/${a.id}/students/${student.id}/invitation`,
    );
    const pupil = client();
    expect(
      (
        await pupil.call('POST', '/v1/invitations/accept', {
          token: new URL(invitation.json().url).searchParams.get('token'),
          fullName: 'Alumno Biblioteca',
          goal: 'Practicar',
          password: 'Student-library-2026!',
          privacyAccepted: true,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await pupil.call('GET', `/v1/organizations/${a.id}/exercises/${exercise.id}`)).statusCode,
    ).toBe(404);
    const published = await a.http.call(
      'PUT',
      `/v1/organizations/${a.id}/exercises/${exercise.id}`,
      { ...exerciseBody, state: 'published', mediaId: movie.id, version: exercise.version },
    );
    expect(published.statusCode, published.body).toBe(200);
    exercise = published.json().exercise;
    expect(
      (
        await a.http.call('POST', `/v1/organizations/${a.id}/exercises/${exercise.id}/students`, {
          studentId: student.id,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await pupil.call('GET', `/v1/organizations/${a.id}/exercises/${exercise.id}`)).json()
        .exercise.name,
    ).toBe(exercise.name);
    expect((await pupil.call('GET', movie.url!)).statusCode).toBe(200);
    expect(
      (
        await pupil.call('POST', `/v1/organizations/${a.id}/media/uploads`, {
          kind: 'image',
          bytes: 1,
          requestId: randomUUID(),
        })
      ).statusCode,
    ).toBe(403);
    expect((await client().call('GET', movie.url!)).statusCode).toBe(401);
    expect(
      (
        await a.http.call(
          'DELETE',
          `/v1/organizations/${a.id}/exercises/${exercise.id}/students/${student.id}`,
        )
      ).statusCode,
    ).toBe(200);
    expect((await pupil.call('GET', movie.url!)).statusCode).toBe(404);
  });
  it('rejects false format, corrupt video, excessive duration and incomplete uploads without reporting readiness', async () => {
    expect((await reserve(b, 'image', 5242881)).statusCode).toBe(413);
    for (const [kind, bytes, code] of [
      ['image', Buffer.from('<svg/>'), 'MEDIA_CORRUPT'],
      ['video', Buffer.from('not a movie'), 'MEDIA_FORMAT'],
      ['video', longClip, 'MEDIA_DURATION'],
    ] as const) {
      const asset = await upload(b, kind, bytes);
      const job = await claimMediaJob(worker, [b.id]);
      expect(job?.payload.mediaId).toBe(asset.id);
      expect(await processMediaJob(worker, job!, { storageRoot: directory })).toBe(false);
      const failed = (
        await b.http.call('GET', `/v1/organizations/${b.id}/media/${asset.id}`)
      ).json().media;
      expect(failed).toMatchObject({ state: 'failed', errorCode: code, url: null });
    }
    const reserved = (await reserve(b, 'image', 100)).json().media;
    expect(
      (
        await b.http.call(
          'PUT',
          `/v1/organizations/${b.id}/media/${reserved.id}/content`,
          Buffer.from('short'),
          { 'content-type': 'application/octet-stream' },
        )
      ).statusCode,
    ).toBe(400);
    expect(
      (await b.http.call('GET', `/v1/organizations/${b.id}/media/${reserved.id}`)).json().media
        .state,
    ).toBe('cancelled');
  });
  it('reserves quota under contention and bounds each organization queue', async () => {
    const owner = await coach('quota');
    const plan = randomUUID(),
      version = randomUUID();
    await admin.query('INSERT INTO saas_plans(id,code,name)VALUES($1,$2,$3)', [
      plan,
      `media-${plan}`,
      'Media test',
    ]);
    await admin.query(
      'INSERT INTO saas_plan_versions(id,plan_id,version_no,per_student_price_pyg,student_limit)VALUES($1,$2,1,10000,25)',
      [version, plan],
    );
    await admin.query('INSERT INTO media_plan_limits VALUES($1,10000000,120)', [version]);
    await admin.query('UPDATE saas_subscriptions SET plan_version_id=$1 WHERE organization_id=$2', [
      version,
      owner.id,
    ]);
    const reservations = await Promise.all([
      reserve(owner, 'image', 5000000),
      reserve(owner, 'image', 5000000),
    ]);
    expect(reservations.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    const queueOwner = await coach('queue');
    const pending = await Promise.all(
      Array.from({ length: 5 }, () => reserve(queueOwner, 'image', 100)),
    );
    expect(pending.filter((r) => r.statusCode === 201)).toHaveLength(4);
    expect(pending.filter((r) => r.json().code === 'MEDIA_QUEUE_FULL')).toHaveLength(1);
  });
  it('fences stale workers, supports an audited retry and cancels without resurrecting files', async () => {
    const asset = await upload(b, 'image', Buffer.from('corrupt'));
    const old = await claimMediaJob(worker, [b.id]);
    expect(await processMediaJob(worker, old!, { storageRoot: directory })).toBe(false);
    expect(
      (await b.http.call('POST', `/v1/organizations/${b.id}/media/${asset.id}/retry`)).statusCode,
    ).toBe(200);
    expect(
      (
        await worker.query('SELECT app.worker_media_finish($1,$2,$3) done', [
          old!.id,
          old!.lease_token,
          '{}',
        ])
      ).rows[0].done,
    ).toBe(false);
    expect(
      (await b.http.call('POST', `/v1/organizations/${b.id}/media/${asset.id}/cancel`)).statusCode,
    ).toBe(200);
    expect(
      (await b.http.call('GET', `/v1/organizations/${b.id}/media/${asset.id}`)).json().media,
    ).toMatchObject({ state: 'cancelled', url: null });
  });
  it('cleans expired reservations and old unreferenced files while retaining referenced outputs', async () => {
    const reserved = (await reserve(a, 'image', 10)).json().media;
    await admin.query("UPDATE media_assets SET expires_at=now()-interval '1 hour' WHERE id=$1", [
      reserved.id,
    ]);
    const orphan = `${randomUUID()}.bin`;
    await writeFile(join(directory, orphan), 'orphan');
    await utimes(join(directory, orphan), new Date(0), new Date(0));
    await maintainMedia(worker, directory);
    expect(
      (await a.http.call('GET', `/v1/organizations/${a.id}/media/${reserved.id}`)).json().media
        .state,
    ).toBe('cancelled');
    await expect(access(join(directory, orphan))).rejects.toThrow();
    expect((await a.http.call('GET', picture.url!)).statusCode).toBe(200);
  });
  it('keeps the API responsive during two conversions and prevents two same-tenant claims', async () => {
    const one = await upload(a, 'video', clip),
      two = await upload(a, 'video', clip),
      other = await upload(b, 'video', clip);
    const claimed = await Promise.all([
      claimMediaJob(worker, [a.id, b.id]),
      claimMediaJob(worker, [a.id, b.id]),
    ]);
    const jobs = claimed.filter((j) => j !== undefined);
    expect(jobs).toHaveLength(2);
    expect(new Set(jobs.map((j) => j.payload.organizationId)).size).toBe(2);
    const running = Promise.all(
      jobs.map((job) => processMediaJob(worker, job, { storageRoot: directory })),
    );
    const latency = [];
    for (let n = 0; n < 5; n++) {
      const start = performance.now();
      expect((await a.http.call('GET', `/v1/organizations/${a.id}/media/usage`)).statusCode).toBe(
        200,
      );
      latency.push(performance.now() - start);
    }
    expect(await running).toEqual([true, true]);
    expect(Math.max(...latency)).toBeLessThan(1000);
    console.info(
      JSON.stringify({
        measurement: 'two_conversions_api_max_ms',
        value: Math.round(Math.max(...latency)),
      }),
    );
    const remaining = await claimMediaJob(worker, [a.id]);
    expect([one.id, two.id]).toContain(remaining!.payload.mediaId);
    expect(await processMediaJob(worker, remaining!, { storageRoot: directory })).toBe(true);
    expect(
      (await b.http.call('GET', `/v1/organizations/${b.id}/media/${other.id}`)).json().media.state,
    ).toBe('ready');
    const totals = (
      await admin.query(
        "SELECT count(*) conversions,coalesce(sum(duration_seconds),0) video_seconds,coalesce(sum(processing_ms),0) processing_ms,coalesce(sum(input_bytes+output_bytes+poster_bytes),0) storage_bytes FROM media_assets WHERE organization_id=ANY($1::uuid[]) AND state='ready'",
        [[a.id, b.id]],
      )
    ).rows[0];
    await writeFile(
      '.local/t03-metrics.json',
      JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          apiMaxMs: Math.round(Math.max(...latency)),
          ...totals,
        },
        null,
        2,
      ),
    );
  });
});
