import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type {
  CurrentUser,
  OrganizationSummary,
  PrivateResource,
  ResourceVersion,
  ResourceDetail,
} from '@forma/shared';
import type { AppConfig } from './app.js';
import { actorTransaction } from './organizations.js';
import { PrivateStorage } from './storage.js';
import { generateToken, tokenDigest } from './security.js';
import { problem } from './problems.js';
import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';
interface Options {
  pool: Pool;
  config: AppConfig;
  context: (
    request: FastifyRequest,
    id: string,
    roles?: string[],
  ) => Promise<{ user: CurrentUser; org: OrganizationSummary }>;
}
const uuid = {
    type: 'string',
    pattern: '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$',
  },
  nullable = { anyOf: [uuid, { type: 'null' }] },
  text = (max: number, min = 0) => ({ type: 'string', minLength: min, maxLength: max });
const orgParams = {
    type: 'object',
    required: ['organizationId'],
    properties: { organizationId: uuid },
  },
  itemParams = {
    ...orgParams,
    required: ['organizationId', 'id'],
    properties: { ...orgParams.properties, id: uuid },
  },
  versionParams = {
    ...itemParams,
    required: ['organizationId', 'id', 'versionId'],
    properties: { ...itemParams.properties, versionId: uuid },
  };
const versionDTO = (r: Record<string, unknown>): ResourceVersion => ({
  id: String(r.id),
  number: Number(r.number),
  kind: r.kind as ResourceVersion['kind'],
  state: String(r.state),
  bytes: Number(r.byte_size),
  templateVersion: r.template_version as string | null,
  errorCode: r.error_code as string | null,
  createdAt: new Date(r.created_at as string).toISOString(),
});
const resourceDTO = (r: Record<string, unknown>): PrivateResource => ({
  id: String(r.id),
  name: String(r.name),
  description: String(r.description),
  collectionId: r.collection_id as string | null,
  subjectStudentId: r.subject_student_id as string | null,
  currentVersionId: r.current_version_id as string | null,
  revision: Number(r.revision),
  archived: !!r.archived_at,
  canManage: !!r.can_manage,
  createdAt: new Date(r.created_at as string).toISOString(),
  current: r.current_data ? versionDTO(r.current_data as Record<string, unknown>) : null,
});
const resourceSelect =
  'SELECT r.*,app.resource_manage(r.organization_id,r.id) can_manage,to_jsonb(v) current_data FROM private_resources r LEFT JOIN resource_versions v ON v.organization_id=r.organization_id AND v.id=r.current_version_id';
export async function registerResources(app: FastifyInstance, { pool, config, context }: Options) {
  const root = '/v1/organizations/:organizationId',
    staff = ['owner', 'coach'],
    storage = new PrivateStorage(
      config.storageRoot ?? process.env.STORAGE_PATH ?? '.local/storage',
      10485760,
    );
  async function run<T>(
    req: FastifyRequest,
    orgId: string,
    manage: boolean,
    fn: (db: PoolClient) => Promise<T>,
  ) {
    const { user, org } = await context(req, orgId, manage ? staff : undefined);
    return actorTransaction(pool, user.id, org.id, fn);
  }
  async function detail(db: PoolClient, id: string): Promise<ResourceDetail> {
    const r = (await db.query(resourceSelect + ' WHERE r.id=$1', [id])).rows[0];
    if (!r) throw problem(404, 'RESOURCE_NOT_FOUND', 'No se encontró el recurso.');
    const [versions, grants] = [
      await db.query('SELECT * FROM resource_versions WHERE resource_id=$1 ORDER BY number DESC', [
        id,
      ]),
      await db.query(
        'SELECT a.student_id "studentId",s.display_name "studentName" FROM resource_student_access a JOIN students s ON s.organization_id=a.organization_id AND s.id=a.student_id WHERE a.resource_id=$1 ORDER BY s.display_name',
        [id],
      ),
    ];
    return {
      resource: resourceDTO(r),
      versions: versions.rows.map(versionDTO),
      grants: grants.rows,
    };
  }
  app.get<{ Params: { organizationId: string }; Querystring: { q?: string; studentId?: string } }>(
    root + '/resource-sources',
    {
      schema: {
        params: orgParams,
        tags: ['resources'],
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { q: text(100), studentId: uuid },
        },
      },
    },
    async (req) =>
      run(req, req.params.organizationId, true, async (db) => {
        if (
          req.query.studentId &&
          !(
            await db.query('SELECT app.can_manage_student($1,$2) ok', [
              req.params.organizationId,
              req.query.studentId,
            ])
          ).rows[0].ok
        )
          throw problem(404, 'STUDENT_NOT_FOUND', 'No se encontró el alumno.');
        const [students, versions, assignments] = [
          await db.query(
            "SELECT id,display_name name FROM students WHERE app.can_manage_student(organization_id,id) AND status='active' AND ($1::text IS NULL OR display_name ILIKE '%'||$1||'%') ORDER BY display_name,id LIMIT 101",
            [req.query.q ?? null],
          ),
          await db.query(
            "SELECT id,snapshot->>'name' name,number FROM program_versions ORDER BY created_at DESC LIMIT 100",
          ),
          req.query.studentId
            ? await db.query(
                'SELECT a.id,a.version_id "versionId",v.snapshot->>\'name\' name,v.number,a.starts_on::text "startsOn" FROM program_assignments a JOIN program_versions v ON v.organization_id=a.organization_id AND v.id=a.version_id WHERE a.organization_id=$1 AND a.student_id=$2 AND a.state=\'active\' ORDER BY a.starts_on DESC LIMIT 50',
                [req.params.organizationId, req.query.studentId],
              )
            : { rows: [] },
        ];
        return {
          students: students.rows.slice(0, 100),
          moreStudents: students.rows.length > 100,
          programVersions: versions.rows,
          assignments: assignments.rows,
        };
      }),
  );
  app.get<{ Params: { organizationId: string } }>(
    root + '/resources/capabilities',
    { schema: { params: orgParams, tags: ['resources'] } },
    async (req) =>
      run(req, req.params.organizationId, true, async (db) => {
        const row = (
          await db.query(
            "SELECT coalesce(bool_or(heartbeat_at>now()-interval '45 seconds'),false) online,coalesce(bool_or(renderer_available AND heartbeat_at>now()-interval '45 seconds'),false) renderer FROM document_worker_heartbeats",
          )
        ).rows[0];
        const quota = (await db.query('SELECT app.resource_usage() data')).rows[0].data;
        return {
          ...quota,
          workerOnline: row.online,
          rendererAvailable: row.renderer,
          pdfUploadsConfigured: !!process.env.CLAMAV_HOST,
        };
      }),
  );
  app.get<{
    Params: { organizationId: string };
    Querystring: { q?: string; collectionId?: string; before?: string };
  }>(
    root + '/resources',
    {
      schema: {
        params: orgParams,
        tags: ['resources'],
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { q: text(100), collectionId: uuid, before: uuid },
        },
      },
    },
    async (req) =>
      run(req, req.params.organizationId, false, async (db) => {
        const rows = (
          await db.query(
            resourceSelect +
              " WHERE r.archived_at IS NULL AND ($1::text IS NULL OR r.name ILIKE '%'||$1||'%' OR r.description ILIKE '%'||$1||'%') AND ($2::uuid IS NULL OR r.collection_id=$2) AND ($3::uuid IS NULL OR (r.created_at,r.id)<(SELECT created_at,id FROM private_resources WHERE id=$3)) ORDER BY r.created_at DESC,r.id DESC LIMIT 25",
            [req.query.q ?? null, req.query.collectionId ?? null, req.query.before ?? null],
          )
        ).rows;
        return {
          resources: rows.slice(0, 24).map(resourceDTO),
          nextBefore: rows.length > 24 ? rows[23].id : null,
        };
      }),
  );
  app.get<{ Params: { organizationId: string } }>(
    root + '/resource-collections',
    { schema: { params: orgParams, tags: ['resources'] } },
    async (req) =>
      run(req, req.params.organizationId, false, async (db) => ({
        collections: (
          await db.query(
            'SELECT id,name,description,student_id "studentId",program_version_id "programVersionId",revision,app.collection_manage(organization_id,id) "canManage" FROM resource_collections ORDER BY name,id LIMIT 200',
          )
        ).rows,
      })),
  );
  const collectionBody = {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'description', 'studentId', 'programVersionId'],
    properties: {
      name: text(100, 2),
      description: text(1500),
      studentId: nullable,
      programVersionId: nullable,
    },
  };
  app.post<{
    Params: { organizationId: string };
    Body: {
      name: string;
      description: string;
      studentId: string | null;
      programVersionId: string | null;
    };
  }>(
    root + '/resource-collections',
    { schema: { params: orgParams, body: collectionBody, tags: ['resources'] } },
    async (req, reply) => {
      const data = await run(req, req.params.organizationId, true, async (db) => ({
        id: (
          await db.query('SELECT app.save_resource_collection(NULL,NULL,$1,$2,$3,$4) id', [
            req.body.name,
            req.body.description,
            req.body.studentId,
            req.body.programVersionId,
          ])
        ).rows[0].id,
      }));
      return reply.code(201).send(data);
    },
  );
  app.put<{
    Params: { organizationId: string; id: string };
    Body: {
      revision: number;
      name: string;
      description: string;
      studentId: string | null;
      programVersionId: string | null;
    };
  }>(
    root + '/resource-collections/:id',
    {
      schema: {
        params: itemParams,
        body: {
          ...collectionBody,
          required: [...collectionBody.required, 'revision'],
          properties: { ...collectionBody.properties, revision: { type: 'integer', minimum: 1 } },
        },
        tags: ['resources'],
      },
    },
    async (req) =>
      run(req, req.params.organizationId, true, async (db) => ({
        id: (
          await db.query('SELECT app.save_resource_collection($1,$2,$3,$4,$5,$6) id', [
            req.params.id,
            req.body.revision,
            req.body.name,
            req.body.description,
            req.body.studentId,
            req.body.programVersionId,
          ])
        ).rows[0].id,
      })),
  );
  const resourceBody = {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'description', 'collectionId'],
    properties: { name: text(100, 2), description: text(1500), collectionId: nullable },
  };
  app.post<{
    Params: { organizationId: string };
    Body: { requestId: string; name: string; description: string; collectionId: string | null };
  }>(
    root + '/resources',
    {
      schema: {
        params: orgParams,
        body: {
          ...resourceBody,
          required: [...resourceBody.required, 'requestId'],
          properties: { ...resourceBody.properties, requestId: uuid },
        },
        tags: ['resources'],
      },
    },
    async (req, reply) => {
      const data = await run(req, req.params.organizationId, true, async (db) => {
        const id = (
          await db.query('SELECT app.create_resource($1,$2,$3,$4) id', [
            req.body.requestId,
            req.body.name,
            req.body.description,
            req.body.collectionId,
          ])
        ).rows[0].id;
        return detail(db, id);
      });
      return reply.code(201).send(data);
    },
  );
  app.get<{ Params: { organizationId: string; id: string } }>(
    root + '/resources/:id',
    { schema: { params: itemParams, tags: ['resources'] } },
    async (req) => run(req, req.params.organizationId, false, (db) => detail(db, req.params.id)),
  );
  app.put<{
    Params: { organizationId: string; id: string };
    Body: {
      revision: number;
      name: string;
      description: string;
      collectionId: string | null;
      archive: boolean;
    };
  }>(
    root + '/resources/:id',
    {
      schema: {
        params: itemParams,
        body: {
          ...resourceBody,
          required: [...resourceBody.required, 'revision', 'archive'],
          properties: {
            ...resourceBody.properties,
            revision: { type: 'integer', minimum: 1 },
            archive: { type: 'boolean' },
          },
        },
        tags: ['resources'],
      },
    },
    async (req) =>
      run(req, req.params.organizationId, true, async (db) => {
        await db.query('SELECT app.change_resource($1,$2,$3,$4,$5,$6)', [
          req.params.id,
          req.body.revision,
          req.body.name,
          req.body.description,
          req.body.collectionId,
          req.body.archive,
        ]);
        return detail(db, req.params.id);
      }),
  );
  const grantBody = {
    type: 'object',
    additionalProperties: false,
    required: ['studentId', 'grant'],
    properties: { studentId: uuid, grant: { type: 'boolean' } },
  };
  for (const [path, fn] of [
    ['resources', 'share_resource'],
    ['resource-collections', 'share_resource_collection'],
  ])
    app.post<{
      Params: { organizationId: string; id: string };
      Body: { studentId: string; grant: boolean };
    }>(
      root + `/${path}/:id/access`,
      { schema: { params: itemParams, body: grantBody, tags: ['resources'] } },
      async (req) =>
        run(req, req.params.organizationId, true, async (db) => {
          await db.query(`SELECT app.${fn}($1,$2,$3)`, [
            req.params.id,
            req.body.studentId,
            req.body.grant,
          ]);
          return { ok: true };
        }),
    );
  app.post<{
    Params: { organizationId: string; id: string };
    Body: {
      requestId: string;
      kind: string;
      bytes?: number;
      mediaId?: string;
      studentId?: string;
      assignmentId?: string;
      from?: string;
      to?: string;
    };
  }>(
    root + '/resources/:id/versions',
    {
      schema: {
        params: itemParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['requestId', 'kind'],
          properties: {
            requestId: uuid,
            kind: {
              type: 'string',
              enum: ['media', 'upload', 'routine', 'history', 'report', 'menu'],
            },
            bytes: { type: 'integer', minimum: 1, maximum: 10485760 },
            mediaId: uuid,
            studentId: uuid,
            assignmentId: uuid,
            from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          },
        },
        tags: ['resources'],
      },
    },
    async (req, reply) => {
      const data = await run(req, req.params.organizationId, true, async (db) => {
        if (req.body.kind === 'upload' && !process.env.CLAMAV_HOST)
          throw problem(
            503,
            'SCANNER_UNAVAILABLE',
            'La subida de PDF necesita el servicio de análisis. Puedes reutilizar medios o generar un PDF.',
          );
        const { requestId, ...input } = req.body;
        const id = (
          await db.query('SELECT app.add_resource_version($1,$2,$3) id', [
            req.params.id,
            requestId,
            input,
          ])
        ).rows[0].id;
        return { versionId: id, ...(await detail(db, req.params.id)) };
      });
      return reply.code(201).send(data);
    },
  );
  let uploading = false;
  app.post<{ Params: { organizationId: string; id: string; versionId: string } }>(
    root + '/resources/:id/versions/:versionId/cancel',
    { schema: { params: versionParams, tags: ['resources'] } },
    async (req) =>
      run(req, req.params.organizationId, true, async (db) => {
        const row = (
          await db.query('SELECT id FROM resource_versions WHERE id=$1 AND resource_id=$2', [
            req.params.versionId,
            req.params.id,
          ])
        ).rows[0];
        if (!row) throw problem(404, 'RESOURCE_NOT_FOUND', 'No se encontró la versión.');
        await db.query('SELECT app.cancel_resource_version($1)', [row.id]);
        return { ok: true };
      }),
  );
  app.put<{ Params: { organizationId: string; id: string; versionId: string } }>(
    root + '/resources/:id/versions/:versionId/content',
    {
      bodyLimit: 10485760,
      schema: { params: versionParams, tags: ['resources'] },
      preParsing: async (req, _reply, payload) => {
        await context(req, req.params.organizationId, staff);
        if (req.headers['content-type'] !== 'application/octet-stream')
          throw problem(415, 'INVALID_RESOURCE', 'Usa el formato de subida indicado.');
        return payload;
      },
    },
    async (req) => {
      if (uploading)
        throw problem(429, 'RESOURCE_BUSY', 'Hay otra carga en curso. Inténtalo al terminar.');
      uploading = true;
      let key: string | undefined,
        kept = false;
      try {
        return await run(req, req.params.organizationId, true, async (db) => {
          await db.query('SELECT pg_advisory_xact_lock_shared(70321021)');
          const v = (
            await db.query('SELECT * FROM resource_versions WHERE id=$1 AND resource_id=$2', [
              req.params.versionId,
              req.params.id,
            ])
          ).rows[0];
          if (
            !v ||
            v.state !== 'reserved' ||
            v.kind !== 'upload' ||
            !(
              await db.query('SELECT app.resource_manage($1,$2) yes', [
                req.params.organizationId,
                req.params.id,
              ])
            ).rows[0].yes
          )
            throw problem(409, 'INVALID_RESOURCE', 'La versión cambió; actualiza el recurso.');
          const result = await storage.putStream(req.body as Readable, Number(v.declared_bytes));
          key = result.key;
          const bytes = await storage.read(key);
          if (
            !/^%PDF-[12]\.\d/.test(bytes.subarray(0, 12).toString('ascii')) ||
            !bytes.subarray(-2048).includes(Buffer.from('%%EOF'))
          )
            throw problem(
              400,
              'INVALID_PDF',
              'El archivo no tiene una estructura PDF reconocible.',
            );
          await db.query('SELECT app.receive_resource_pdf($1,$2,$3,$4)', [
            v.id,
            key,
            result.hash,
            result.bytes,
          ]);
          return { ok: true };
        }).then((result) => {
          kept = true;
          return result;
        });
      } finally {
        uploading = false;
        if (key && !kept) await storage.remove(key).catch(() => {});
      }
    },
  );
  app.post<{ Params: { organizationId: string; id: string; versionId: string } }>(
    root + '/resources/:id/versions/:versionId/retry',
    { schema: { params: versionParams, tags: ['resources'] } },
    async (req) =>
      run(req, req.params.organizationId, true, async (db) => {
        const row = (
          await db.query('SELECT id FROM resource_versions WHERE id=$1 AND resource_id=$2', [
            req.params.versionId,
            req.params.id,
          ])
        ).rows[0];
        if (!row) throw problem(404, 'RESOURCE_NOT_FOUND', 'No se encontró la versión.');
        await db.query('SELECT app.retry_resource_version($1)', [row.id]);
        return { ok: true };
      }),
  );
  app.post<{ Params: { organizationId: string; id: string; versionId: string } }>(
    root + '/resources/:id/versions/:versionId/link',
    { schema: { params: versionParams, tags: ['resources'] } },
    async (req, reply) => {
      const token = generateToken(),
        path = `/v1/organizations/${req.params.organizationId}/resources/${req.params.id}/versions/${req.params.versionId}/file`;
      await run(req, req.params.organizationId, false, (db) =>
        db.query('SELECT app.issue_resource_ticket($1,$2,$3)', [
          req.params.id,
          req.params.versionId,
          tokenDigest(token),
        ]),
      );
      reply.setCookie('forma_resource_ticket', token, {
        httpOnly: true,
        secure: !!config.production,
        sameSite: 'strict',
        path,
        maxAge: 300,
      });
      return { url: path, expiresAt: new Date(Date.now() + 300000).toISOString() };
    },
  );
  app.get<{
    Params: { organizationId: string; id: string; versionId: string };
    Querystring: { download?: string };
  }>(
    root + '/resources/:id/versions/:versionId/file',
    {
      schema: {
        params: versionParams,
        tags: ['resources'],
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { download: { type: 'string', enum: ['1'] } },
        },
      },
    },
    async (req, reply) => {
      const data = await run(
        req,
        req.params.organizationId,
        false,
        async (db) =>
          (
            await db.query('SELECT app.use_resource_ticket($1,$2,$3) data', [
              req.params.id,
              req.params.versionId,
              tokenDigest(req.cookies.forma_resource_ticket ?? ''),
            ])
          ).rows[0].data,
      );
      let info;
      try {
        info = await storage.info(data.key);
      } catch {
        throw problem(
          404,
          'RESOURCE_UNAVAILABLE',
          'El archivo no está disponible; contacta con tu coach.',
        );
      }
      const attachment = req.query.download === '1' || data.kind === 'upload';
      reply
        .header('Content-Type', data.mime)
        .header('Cache-Control', 'private, no-store')
        .header('X-Content-Type-Options', 'nosniff')
        .header(
          'Content-Disposition',
          `${attachment ? 'attachment' : 'inline'}; filename="recurso-${req.params.versionId}.${data.mime === 'application/pdf' ? 'pdf' : data.mime === 'video/mp4' ? 'mp4' : 'webp'}"`,
        )
        .header('Accept-Ranges', 'bytes');
      if (data.mime === 'application/pdf')
        reply.header('Content-Security-Policy', "sandbox; default-src 'none'");
      const range = req.headers.range;
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range);
        let start: number,
          end = info.size - 1;
        if (!m || (!m[1] && !m[2]))
          return reply.code(416).header('Content-Range', `bytes */${info.size}`).send();
        if (m[1]) {
          start = Number(m[1]);
          if (m[2]) end = Math.min(end, Number(m[2]));
        } else start = Math.max(0, info.size - Number(m[2]));
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start < 0 ||
          start > end ||
          start >= info.size
        )
          return reply.code(416).header('Content-Range', `bytes */${info.size}`).send();
        return reply
          .code(206)
          .header('Content-Range', `bytes ${start}-${end}/${info.size}`)
          .header('Content-Length', end - start + 1)
          .send(createReadStream(info.path, { start, end }));
      }
      return reply.header('Content-Length', info.size).send(createReadStream(info.path));
    },
  );
}
