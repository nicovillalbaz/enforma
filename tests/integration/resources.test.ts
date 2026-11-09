import { approveFixtureCoach } from '../helpers/coach-approval.js';
import 'dotenv/config';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { buildApp } from '../../apps/api/src/app.js';
import { actorTransaction } from '../../apps/api/src/organizations.js';
import { isolatedDatabase } from '../helpers/database.js';
import { createServer, type Server } from 'node:net';
import { PrivateStorage } from '../../apps/api/src/storage.js';
import { claimDocumentJob, processDocumentJob } from '../../apps/worker/src/documents.js';
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

function tinyPdf(marker = '') {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const content = 'BT /F1 16 Tf 50 780 Td (Manual ficticio T08) Tj ET';
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(body));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%${marker}\n%%EOF\n`;
  return Buffer.from(body);
}
let a: Coach,
  b: Coach,
  s1: Awaited<ReturnType<typeof pupil>>,
  s2: Awaited<ReturnType<typeof pupil>>,
  root: string,
  collectionId: string,
  resourceId: string,
  mediaVersion: string,
  mediaId: string,
  reportResource: string,
  reportVersion: string,
  cleanUploadVersion: string,
  scanner: Server,
  scannerPort: number;
const sockets = new Set<import('node:net').Socket>(),
  originalScanner = process.env.CLAMAV_HOST;
beforeAll(async () => {
  directory = await fixture.create();
  server = await buildApp({
    origin: 'http://127.0.0.1:5173',
    cookieSecret: 'resources-tests-secret-at-least-32-characters',
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    storageRoot: directory,
    developmentMailbox: true,
  });
  server.addHook('onError', (_req, _reply, e, done) => {
    if (e.code && ['42702', '42501', '42883', '42P01'].includes(e.code))
      console.error({ code: e.code, message: e.message });
    done();
  });
  a = await coach('resources');
  b = await coach('foreign');
  s1 = await pupil(a, 'Alumna Recursos');
  s2 = await pupil(a, 'Otro Alumno');
  root = `/v1/organizations/${a.id}`;
  scanner = createServer((socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    let pending = Buffer.alloc(0),
      command = false;
    const chunks: Buffer[] = [];
    socket.on('data', (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      if (!command) {
        if (pending.length < 10) return;
        expect(pending.subarray(0, 10).toString()).toBe('zINSTREAM\0');
        pending = pending.subarray(10);
        command = true;
      }
      while (pending.length >= 4) {
        const size = pending.readUInt32BE();
        if (!size) {
          const reject = Buffer.concat(chunks).includes(Buffer.from('SCANNER-REJECT-MARKER'));
          socket.end(reject ? 'stream: Fixture.Test FOUND\0' : 'stream: OK\0');
          return;
        }
        if (pending.length < 4 + size) return;
        chunks.push(pending.subarray(4, 4 + size));
        pending = pending.subarray(4 + size);
      }
    });
  });
  await new Promise<void>((resolve) => scanner.listen(0, '127.0.0.1', resolve));
  scannerPort = (scanner.address() as import('node:net').AddressInfo).port;
  process.env.CLAMAV_HOST = '127.0.0.1';
}, 40000);
afterAll(async () => {
  if (originalScanner === undefined) delete process.env.CLAMAV_HOST;
  else process.env.CLAMAV_HOST = originalScanner;
  for (const socket of sockets) socket.destroy();
  if (scanner) await new Promise<void>((resolve) => scanner.close(() => resolve()));
  await server?.close();
  await Promise.all([api.end(), worker.end(), admin.end()]);
  await fixture.drop();
});
async function resource(name: string) {
  const r = await a.http.call('POST', root + '/resources', {
    requestId: randomUUID(),
    name,
    description: 'Material ficticio de pruebas',
    collectionId: collectionId ?? null,
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().resource.id as string;
}
async function version(id: string, data: Record<string, unknown>) {
  const r = await a.http.call('POST', root + `/resources/${id}/versions`, {
    requestId: randomUUID(),
    ...data,
  });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().versionId as string;
}
async function processOne(
  render?: NonNullable<Parameters<typeof processDocumentJob>[2]>['render'],
) {
  const job = await claimDocumentJob(worker, a.id);
  expect(job).toBeDefined();
  return processDocumentJob(worker, job!, {
    storageRoot: directory,
    scanner: { host: '127.0.0.1', port: scannerPort },
    render,
  });
}
it('creates collections/resources with ownership, idempotence and optimistic revision', async () => {
  const c = await a.http.call('POST', root + '/resource-collections', {
    name: 'Biblioteca inicial',
    description: 'Educación y entrenamiento',
    studentId: s1.id,
    programVersionId: null,
  });
  expect(c.statusCode, c.body).toBe(201);
  collectionId = c.json().id;
  const requestId = randomUUID(),
    body = {
      requestId,
      name: 'Manual de inicio',
      description: 'Material ficticio de pruebas',
      collectionId,
    };
  const r = await a.http.call('POST', root + '/resources', body);
  expect(r.statusCode, r.body).toBe(201);
  resourceId = r.json().resource.id;
  expect((await a.http.call('POST', root + '/resources', body)).json().resource.id).toBe(
    resourceId,
  );
  expect(
    (await a.http.call('POST', root + '/resources', { ...body, name: 'Otro nombre' })).statusCode,
  ).toBe(409);
  expect((await b.http.call('GET', root + '/resources/' + resourceId)).statusCode).toBe(404);
  expect((await s1.http.call('GET', root + '/resources/' + resourceId)).statusCode).toBe(404);
  const change = {
    revision: 1,
    name: 'Manual actualizado',
    description: 'Descripción actualizada',
    collectionId,
    archive: false,
  };
  expect((await a.http.call('PUT', root + '/resources/' + resourceId, change)).statusCode).toBe(
    200,
  );
  expect((await a.http.call('PUT', root + '/resources/' + resourceId, change)).json().code).toBe(
    'STALE_RESOURCE',
  );
  await expect(
    actorTransaction(api, a.userId, a.id, (db) =>
      db.query('UPDATE private_resources SET name=$1 WHERE id=$2', ['Intrusión', resourceId]),
    ),
  ).rejects.toMatchObject({ code: '42501' });
});
it('reuses normalized media, binds temporary delivery to the user and revokes immediately', async () => {
  const storage = new PrivateStorage(directory),
    bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#225577' } })
      .webp()
      .toBuffer(),
    key = await storage.put(bytes, 'webp');
  mediaId = (
    await admin.query(
      "INSERT INTO media_assets(organization_id,created_by,request_id,kind,state,declared_bytes,reserved_bytes,output_key,output_bytes,mime_type)VALUES($1,$2,$3,'image','ready',$4::integer,0,$5,$4::integer::bigint,'image/webp') RETURNING id",
      [a.id, a.userId, randomUUID(), bytes.length, key],
    )
  ).rows[0].id;
  mediaVersion = await version(resourceId, { kind: 'media', mediaId });
  expect((await a.http.call('POST', root + `/media/${mediaId}/delete`)).json().code).toBe(
    'MEDIA_REFERENCED',
  );
  expect(
    (
      await a.http.call('POST', root + `/resources/${resourceId}/access`, {
        studentId: s1.id,
        grant: true,
      })
    ).statusCode,
  ).toBe(200);
  const link = await s1.http.call(
    'POST',
    root + `/resources/${resourceId}/versions/${mediaVersion}/link`,
  );
  expect(link.statusCode, link.body).toBe(200);
  const url = link.json().url;
  expect(url).not.toContain('token');
  expect(String(link.headers['set-cookie'])).toContain('HttpOnly');
  const response = await s1.http.call('GET', url);
  expect(response.statusCode, response.body).toBe(200);
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect((await s1.http.call('GET', url, undefined, { range: 'bytes=0-9' })).statusCode).toBe(206);
  const token = /forma_resource_ticket=([^;]+)/.exec(String(link.headers['set-cookie']))![1];
  expect(
    (
      await s2.http.call('GET', url, undefined, {
        cookie: s2.http.cookies + `; forma_resource_ticket=${token}`,
      })
    ).statusCode,
  ).toBe(403);
  expect((await s1.http.call('GET', root + `/media/${mediaId}/file`)).statusCode).toBe(404);
  await a.http.call('POST', root + `/resources/${resourceId}/access`, {
    studentId: s1.id,
    grant: false,
  });
  expect((await s1.http.call('GET', url)).statusCode).toBe(404);
});
it('keeps uploaded PDFs unavailable until a clean scanner reply and rejects corrupt/type/size input', async () => {
  const id = await resource('Manual PDF privado'),
    bytes = tinyPdf();
  cleanUploadVersion = await version(id, { kind: 'upload', bytes: bytes.length });
  expect(
    (await a.http.call('POST', root + `/resources/${id}/versions/${cleanUploadVersion}/link`))
      .statusCode,
  ).toBe(404);
  const upload = await a.http.call(
    'PUT',
    root + `/resources/${id}/versions/${cleanUploadVersion}/content`,
    bytes as unknown as Record<string, unknown>,
    { 'content-type': 'application/octet-stream' },
  );
  expect(upload.statusCode, upload.body).toBe(200);
  expect(await processOne()).toBe(true);
  const link = await a.http.call(
    'POST',
    root + `/resources/${id}/versions/${cleanUploadVersion}/link`,
  );
  const downloaded = await a.http.call('GET', link.json().url);
  expect(downloaded.statusCode, downloaded.body).toBe(200);
  expect(downloaded.headers['content-disposition']).toContain('attachment');
  const corrupt = await version(id, { kind: 'upload', bytes: 8 });
  expect(
    (
      await a.http.call(
        'PUT',
        root + `/resources/${id}/versions/${corrupt}/content`,
        Buffer.from('notapdf!') as unknown as Record<string, unknown>,
        { 'content-type': 'application/octet-stream' },
      )
    ).json().code,
  ).toBe('INVALID_PDF');
  expect(
    (
      await a.http.call('POST', root + `/resources/${id}/versions`, {
        requestId: randomUUID(),
        kind: 'upload',
        bytes: 10485761,
      })
    ).statusCode,
  ).toBe(400);
  const saved = process.env.CLAMAV_HOST;
  delete process.env.CLAMAV_HOST;
  expect(
    (
      await a.http.call('POST', root + `/resources/${id}/versions`, {
        requestId: randomUUID(),
        kind: 'upload',
        bytes: 100,
      })
    ).statusCode,
  ).toBe(503);
  process.env.CLAMAV_HOST = saved;
});
it('quarantines a rejected PDF without advertising a successful scan', async () => {
  const id = await resource('PDF rechazado'),
    bytes = tinyPdf('SCANNER-REJECT-MARKER'),
    v = await version(id, { kind: 'upload', bytes: bytes.length });
  await a.http.call(
    'PUT',
    root + `/resources/${id}/versions/${v}/content`,
    bytes as unknown as Record<string, unknown>,
    { 'content-type': 'application/octet-stream' },
  );
  expect(await processOne()).toBe(false);
  const data = (await a.http.call('GET', root + '/resources/' + id)).json();
  expect(data.versions[0]).toMatchObject({ state: 'rejected', errorCode: 'DOCUMENT_REJECTED' });
  expect((await a.http.call('POST', root + `/resources/${id}/versions/${v}/link`)).statusCode).toBe(
    404,
  );
});
it('freezes personal report/brand snapshots, denies another pupil and reuses generation requests', async () => {
  reportResource = await resource('Informe personal');
  const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
    requestId = randomUUID(),
    body = { requestId, kind: 'report', studentId: s1.id, from: day, to: day };
  const response = await a.http.call('POST', root + `/resources/${reportResource}/versions`, body);
  expect(response.statusCode, response.body).toBe(201);
  reportVersion = response.json().versionId;
  expect(
    (await a.http.call('POST', root + `/resources/${reportResource}/versions`, body)).json()
      .versionId,
  ).toBe(reportVersion);
  expect(
    (
      await a.http.call('POST', root + `/resources/${reportResource}/access`, {
        studentId: s2.id,
        grant: true,
      })
    ).statusCode,
  ).toBe(400);
  const before = (
    await admin.query('SELECT snapshot FROM resource_versions WHERE id=$1', [reportVersion])
  ).rows[0].snapshot;
  await admin.query('UPDATE organizations SET name=$1 WHERE id=$2', [
    'Marca cambiada después',
    a.id,
  ]);
  let captured: unknown;
  expect(
    await processOne(async (snapshot) => {
      captured = snapshot;
      return { pdf: tinyPdf(), html: '' };
    }),
  ).toBe(true);
  expect(captured).toEqual(before);
  expect(captured).toMatchObject({ measurements: [], measurementsPrivate: false });
  expect(JSON.stringify(captured)).not.toMatch(/progress_photos|receipt_key|password/);
  await admin.query(
    "INSERT INTO organization_memberships(organization_id,user_id,role)VALUES($1,$2,'coach')",
    [a.id, b.userId],
  );
  await admin.query('INSERT INTO student_professionals VALUES($1,$2,$3)', [a.id, s1.id, b.userId]);
  expect((await b.http.call('GET', root + '/resources/' + reportResource)).statusCode).toBe(404);
  await expect(
    admin.query('UPDATE resource_versions SET snapshot=$1 WHERE id=$2', [{}, reportVersion]),
  ).rejects.toMatchObject({ message: 'IMMUTABLE_VERSION' });
  await a.http.call('POST', root + `/resources/${reportResource}/access`, {
    studentId: s1.id,
    grant: true,
  });
  const link = await s1.http.call(
    'POST',
    root + `/resources/${reportResource}/versions/${reportVersion}/link`,
  );
  expect(link.statusCode, link.body).toBe(200);
  expect(
    (await s1.http.call('POST', root + `/resources/${reportResource}/versions`, body)).statusCode,
  ).toBe(403);
});
it('checks the studio quota against documents for new media and the monthly generation limit', async () => {
  const plan = (
    await admin.query('SELECT plan_version_id FROM saas_subscriptions WHERE organization_id=$1', [
      a.id,
    ])
  ).rows[0].plan_version_id;
  const capacity = Number(
    (
      await admin.query('SELECT storage_bytes FROM media_plan_limits WHERE plan_version_id=$1', [
        plan,
      ])
    ).rows[0].storage_bytes,
  );
  const held = (
    await admin.query(
      "SELECT id,reserved_bytes FROM resource_versions WHERE organization_id=$1 AND state='reserved' LIMIT 1",
      [a.id],
    )
  ).rows[0];
  await admin.query('UPDATE resource_versions SET reserved_bytes=$1 WHERE id=$2', [
    capacity + 1,
    held.id,
  ]);
  try {
    const result = await a.http.call('POST', root + '/media/uploads', {
      kind: 'image',
      bytes: 100,
      requestId: randomUUID(),
    });
    expect(result.json().code, result.body).toBe('MEDIA_QUOTA');
  } finally {
    await admin.query('UPDATE resource_versions SET reserved_bytes=$1 WHERE id=$2', [
      held.reserved_bytes,
      held.id,
    ]);
  }
  expect(
    (await a.http.call('GET', root + '/resources/capabilities')).json().generatedThisMonth,
  ).toBe(1);
  await admin.query(
    "INSERT INTO resource_versions(organization_id,resource_id,request_id,number,kind,state,snapshot,template_version,created_by)SELECT organization_id,resource_id,gen_random_uuid(),i+1,kind,'failed',snapshot,template_version,created_by FROM resource_versions CROSS JOIN generate_series(1,9) i WHERE id=$1",
    [reportVersion],
  );
  const original = (
    await admin.query('SELECT request_id,snapshot FROM resource_versions WHERE id=$1', [
      reportVersion,
    ])
  ).rows[0];
  const body = {
    kind: 'report',
    studentId: s1.id,
    from: original.snapshot.from,
    to: original.snapshot.to,
  };
  expect(
    (
      await a.http.call('POST', root + `/resources/${reportResource}/versions`, {
        ...body,
        requestId: randomUUID(),
      })
    ).json().code,
  ).toBe('RESOURCE_MONTHLY_LIMIT');
  expect(
    (
      await a.http.call('POST', root + `/resources/${reportResource}/versions`, {
        ...body,
        requestId: original.request_id,
      })
    ).json().versionId,
  ).toBe(reportVersion);
});
it('applies collection sharing to current items and blocks stale links after archive', async () => {
  expect(
    (
      await a.http.call('POST', root + `/resource-collections/${collectionId}/access`, {
        studentId: s2.id,
        grant: true,
      })
    ).statusCode,
  ).toBe(400); // Personal report blocks the entire grant transaction.
  expect((await s2.http.call('GET', root + '/resources/' + resourceId)).statusCode).toBe(404);
  await a.http.call('POST', root + `/resources/${resourceId}/access`, {
    studentId: s1.id,
    grant: true,
  });
  const link = await s1.http.call(
    'POST',
    root + `/resources/${resourceId}/versions/${mediaVersion}/link`,
  );
  const data = (await a.http.call('GET', root + '/resources/' + resourceId)).json().resource;
  const archived = await a.http.call('PUT', root + '/resources/' + resourceId, {
    revision: data.revision,
    name: data.name,
    description: data.description,
    collectionId,
    archive: true,
  });
  expect(archived.statusCode, archived.body).toBe(200);
  expect((await s1.http.call('GET', link.json().url)).statusCode).toBe(404);
});
it('inventories private document bytes for backups and purges only after the retention window', async () => {
  const record = (
    await admin.query('SELECT output_key FROM resource_versions WHERE id=$1', [cleanUploadVersion])
  ).rows[0];
  const refs = (await worker.query('SELECT app.media_storage_references() key')).rows.map(
    (r) => r.key,
  );
  expect(refs).toContain(record.output_key);
  await admin.query(
    "UPDATE private_resources SET archived_at=now()-interval '31 days' WHERE id=(SELECT resource_id FROM resource_versions WHERE id=$1)",
    [cleanUploadVersion],
  );
  const purged = (await worker.query('SELECT app.media_maintenance() keys')).rows[0].keys;
  expect(purged).toContain(record.output_key);
  expect(
    (
      await admin.query('SELECT state,output_key FROM resource_versions WHERE id=$1', [
        cleanUploadVersion,
      ])
    ).rows[0],
  ).toEqual({ state: 'purged', output_key: null });
  expect(
    (
      await admin.query(
        "SELECT count(*)::integer n FROM audit_logs WHERE organization_id=$1 AND action='resource.downloaded'",
        [a.id],
      )
    ).rows[0].n,
  ).toBeGreaterThan(0);
});
it('cancels a pending preparation while preserving the resource and denying delivery', async () => {
  const id = await resource('Preparación cancelable'),
    v = await version(id, { kind: 'upload', bytes: 100 });
  expect(
    (await a.http.call('POST', root + `/resources/${id}/versions/${v}/cancel`)).statusCode,
  ).toBe(200);
  expect((await a.http.call('GET', root + '/resources/' + id)).json().versions[0]).toMatchObject({
    state: 'failed',
    errorCode: 'DOCUMENT_CANCELLED',
  });
  expect((await a.http.call('POST', root + `/resources/${id}/versions/${v}/link`)).statusCode).toBe(
    404,
  );
  expect(
    (
      await admin.query('SELECT reserved_bytes::integer bytes FROM resource_versions WHERE id=$1', [
        v,
      ])
    ).rows[0].bytes,
  ).toBe(0);
});
