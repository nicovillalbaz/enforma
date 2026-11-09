import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';
import type { CurrentUser, OrganizationSummary } from '@forma/shared';
import type { AppConfig } from './app.js';
import { actorTransaction } from './organizations.js';
import { problem } from './problems.js';
import { PrivateStorage } from './storage.js';
import { registerFollowupRealtime } from './followup-realtime.js';

export interface FollowupOptions {
  pool: Pool;
  config: AppConfig;
  context: (
    request: FastifyRequest,
    id: string,
    roles?: string[],
  ) => Promise<{ user: CurrentUser; org: OrganizationSummary }>;
}
const uuid = { type: 'string', format: 'uuid' },
  date = { type: 'string', format: 'date' },
  boolean = { type: 'boolean' },
  revision = { type: 'integer', minimum: 0 },
  text = (max: number, min = 0) => ({ type: 'string', maxLength: max, minLength: min }),
  number = { type: ['number', 'null'], minimum: -1000000, maximum: 1000000 },
  object = (properties: Record<string, unknown>) => ({
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  }),
  array = (items: unknown, max: number) => ({ type: 'array', items, maxItems: max }),
  params = object({ organizationId: uuid }),
  item = object({ organizationId: uuid, id: uuid });
const field = object({
    id: uuid,
    label: text(150, 1),
    type: { enum: ['text', 'number', 'scale', 'choice', 'boolean', 'attachment'] },
    required: boolean,
    min: number,
    max: number,
    options: array(text(100, 1), 20),
    unit: text(30),
  }),
  document = object({
    name: text(100, 2),
    description: text(2000),
    fields: { ...array(field, 12), minItems: 1 },
  });
type P = { organizationId: string; id: string };
const cursorSchema = { type: 'string', maxLength: 100, pattern: '^[A-Za-z0-9_-]+$' };
function cursor(value?: string): [string, string] | null {
  if (!value) return null;
  try {
    const v = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (
      Array.isArray(v) &&
      v.length === 2 &&
      typeof v[0] === 'string' &&
      Number.isFinite(Date.parse(v[0])) &&
      /^[a-f0-9-]{36}$/i.test(v[1])
    )
      return v as [string, string];
  } catch {
    /* Invalid metadata or origin is ignored. */
  }
  throw problem(400, 'INVALID_CURSOR', 'Actualiza la lista.');
}
function nextCursor(rows: { at: string; id: string }[]) {
  return rows.length > 30
    ? Buffer.from(JSON.stringify([rows[29]!.at, rows[29]!.id])).toString('base64url')
    : null;
}
export async function registerFollowup(app: FastifyInstance, options: FollowupOptions) {
  const { pool, context, config } = options,
    root = '/v1/organizations/:organizationId/followup',
    storage = new PrivateStorage(
      config.storageRoot ?? process.env.STORAGE_PATH ?? '.local/storage',
      20 * 1024 * 1024,
    );
  let uploading = false;
  const run = async <T>(req: FastifyRequest, id: string, fn: (db: PoolClient) => Promise<T>) => {
    const { user, org } = await context(req, id);
    return actorTransaction(pool, user.id, org.id, fn);
  };
  async function check(db: PoolClient, id: string, write = false) {
    if (!(await db.query('SELECT app.followup_access($1,$2) ok', [id, write])).rows[0].ok)
      throw problem(404, 'FOLLOWUP_NOT_FOUND', 'Conversación no disponible.');
  }
  async function attachment(db: PoolClient, id: string, org: string) {
    const data = (await db.query('SELECT app.followup_attachment_info($1) data', [id])).rows[0]
      .data;
    if (!data) return null;
    const url = `/v1/organizations/${org}/followup/attachments/${id}/file`;
    return {
      ...data,
      url: data.state === 'ready' ? url : null,
      posterUrl: data.state === 'ready' && data.kind === 'video' ? url + '?poster=1' : null,
    };
  }
  app.get<{ Params: P; Querystring: { q?: string; cursor?: string; notificationCursor?: string } }>(
    root,
    {
      schema: {
        params,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { q: text(100), cursor: cursorSchema, notificationCursor: cursorSchema },
        },
      },
    },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        const c = cursor(req.query.cursor),
          n = cursor(req.query.notificationCursor),
          threads = (
            await db.query(
              'SELECT id,last_at::text at,app.followup_thread_info(id) data FROM followup_threads WHERE ($1::timestamptz IS NULL OR(last_at,id)<($1,$2::uuid)) ORDER BY last_at DESC,id DESC LIMIT 31',
              [c?.[0] ?? null, c?.[1] ?? null],
            )
          ).rows,
          notifications = (
            await db.query(
              'SELECT id,thread_id,kind,created_at::text at,read_at IS NOT NULL read FROM followup_notifications WHERE ($1::timestamptz IS NULL OR(created_at,id)<($1,$2::uuid)) ORDER BY created_at DESC,id DESC LIMIT 31',
              [n?.[0] ?? null, n?.[1] ?? null],
            )
          ).rows;
        const prefs = (
          await db.query(
            'SELECT revision,message,checkin,comment FROM followup_notification_preferences',
          )
        ).rows[0] ?? { revision: 0, message: true, checkin: true, comment: true };
        return {
          threads: threads.slice(0, 30).map((r) => r.data),
          nextCursor: nextCursor(threads),
          contacts: (await db.query('SELECT app.followup_contacts($1) data', [req.query.q ?? '']))
            .rows[0].data,
          notifications: notifications.slice(0, 30).map((r) => ({
            id: r.id,
            threadId: r.thread_id,
            kind: r.kind,
            createdAt: r.at,
            read: r.read,
          })),
          nextNotificationCursor: nextCursor(notifications),
          preferences: prefs,
          workerOnline: !!(
            await db.query(
              "SELECT 1 FROM followup_worker_state WHERE heartbeat_at>now()-interval '3 minutes'",
            )
          ).rowCount,
          pdfUploadsEnabled: !!process.env.CLAMAV_HOST,
        };
      }),
  );
  app.post<{ Params: P; Body: { studentId: string; professionalId: string } }>(
    root + '/threads',
    { schema: { params, body: object({ studentId: uuid, professionalId: uuid }) } },
    async (req) =>
      run(req, req.params.organizationId, async (db) => ({
        id: (
          await db.query('SELECT app.open_followup_thread($1,$2) id', [
            req.body.studentId,
            req.body.professionalId,
          ])
        ).rows[0].id,
      })),
  );
  app.get<{ Params: P; Querystring: { before?: number; after?: number } }>(
    root + '/threads/:id/messages',
    {
      schema: {
        params: item,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            before: { type: 'integer', minimum: 1 },
            after: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        await check(db, req.params.id);
        const { before, after } = req.query;
        if (before !== undefined && after !== undefined)
          throw problem(400, 'INVALID_CURSOR', 'Elige una dirección de lectura.');
        const rows = (
            await db.query(
              `SELECT id,seq::float8,sender_id,body,created_at,withdrawn_at,attachment_ids FROM followup_messages WHERE thread_id=$1 AND ($2::bigint IS NULL OR seq<$2) AND ($3::bigint IS NULL OR seq>$3) ORDER BY seq ${after !== undefined ? 'ASC' : 'DESC'} LIMIT 41`,
              [req.params.id, before ?? null, after ?? null],
            )
          ).rows,
          chosen = rows.slice(0, 40);
        if (after === undefined) chosen.reverse();
        const messages = [];
        for (const r of chosen) {
          const attachments = [];
          for (const id of r.attachment_ids) {
            const a = await attachment(db, id, req.params.organizationId);
            if (a) attachments.push(a);
          }
          messages.push({
            id: r.id,
            seq: r.seq,
            senderId: r.sender_id,
            body: r.body,
            createdAt: r.created_at,
            withdrawn: !!r.withdrawn_at,
            attachments,
          });
        }
        return {
          thread: (await db.query('SELECT app.followup_thread_info($1) data', [req.params.id]))
            .rows[0].data,
          settings: (
            await db.query(
              'SELECT revision,muted,tracking_consent "trackingConsent" FROM followup_reads WHERE thread_id=$1',
              [req.params.id],
            )
          ).rows[0] ?? { revision: 0, muted: false, trackingConsent: false },
          messages,
          hasMore: rows.length > 40,
        };
      }),
  );
  app.post<{ Params: P; Body: { clientId: string; body: string; attachments: string[] } }>(
    root + '/threads/:id/messages',
    {
      schema: {
        params: item,
        body: object({
          clientId: uuid,
          body: text(4000),
          attachments: { ...array(uuid, 3), uniqueItems: true },
        }),
      },
    },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.send_followup_message($1,$2,$3,$4) data', [
              req.params.id,
              req.body.clientId,
              req.body.body,
              req.body.attachments,
            ])
          ).rows[0].data,
      ),
  );
  app.post<{ Params: P }>(
    root + '/messages/:id/withdraw',
    { schema: { params: item } },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        await db.query('SELECT app.withdraw_followup_message($1)', [req.params.id]);
        return { ok: true };
      }),
  );
  app.post<{ Params: P; Body: { seq: number } }>(
    root + '/threads/:id/read',
    {
      schema: {
        params: item,
        body: object({ seq: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER } }),
      },
    },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        await db.query('SELECT app.read_followup_thread($1,$2)', [req.params.id, req.body.seq]);
        return { ok: true };
      }),
  );
  app.put<{ Params: P; Body: { revision: number; muted: boolean; trackingConsent: boolean } }>(
    root + '/threads/:id/settings',
    {
      schema: {
        params: item,
        body: object({ revision, muted: boolean, trackingConsent: boolean }),
      },
    },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        const b = req.body;
        await db.query('SELECT app.set_followup_settings($1,$2,$3,$4)', [
          req.params.id,
          b.revision,
          b.muted,
          b.trackingConsent,
        ]);
        return { ok: true };
      }),
  );
  app.put<{
    Params: P;
    Body: { revision: number; message: boolean; checkin: boolean; comment: boolean };
  }>(
    root + '/preferences',
    {
      schema: {
        params,
        body: object({ revision, message: boolean, checkin: boolean, comment: boolean }),
      },
    },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        const b = req.body;
        await db.query('SELECT app.set_followup_preferences($1,$2,$3,$4)', [
          b.revision,
          b.message,
          b.checkin,
          b.comment,
        ]);
        return { ok: true };
      }),
  );
  app.post<{ Params: P; Body: { ids: string[] } }>(
    root + '/notifications/read',
    { schema: { params, body: object({ ids: array(uuid, 50) }) } },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        await db.query('SELECT app.read_followup_notifications($1)', [req.body.ids]);
        return { ok: true };
      }),
  );
  app.post<{
    Params: P;
    Body: {
      requestId: string;
      kind: string;
      name: string;
      bytes: number;
      versionId: string | null;
    };
  }>(
    root + '/threads/:id/attachments',
    {
      schema: {
        params: item,
        body: object({
          requestId: uuid,
          kind: { enum: ['image', 'video', 'audio', 'pdf', 'resource'] },
          name: text(100, 1),
          bytes: { type: 'integer', minimum: 0, maximum: 20971520 },
          versionId: { anyOf: [uuid, { type: 'null' }] },
        }),
      },
    },
    async (req) => {
      if (req.body.kind === 'pdf' && !process.env.CLAMAV_HOST)
        throw problem(
          503,
          'SCANNER_UNAVAILABLE',
          'Los PDF se habilitan cuando el análisis de archivos esté disponible.',
        );
      return run(req, req.params.organizationId, async (db) => {
        const b = req.body,
          id = (
            await db.query('SELECT app.reserve_followup_attachment($1,$2,$3,$4,$5,$6) id', [
              req.params.id,
              b.requestId,
              b.kind,
              b.name,
              b.bytes,
              b.versionId,
            ])
          ).rows[0].id;
        return { id, attachment: await attachment(db, id, req.params.organizationId) };
      });
    },
  );
  app.get<{ Params: P }>(root + '/attachments/:id', { schema: { params: item } }, async (req) =>
    run(req, req.params.organizationId, async (db) => {
      const a = await attachment(db, req.params.id, req.params.organizationId);
      if (!a) throw problem(404, 'FOLLOWUP_NOT_FOUND', 'Adjunto no disponible.');
      return a;
    }),
  );
  app.post<{ Params: P }>(
    root + '/attachments/:id/revoke',
    { schema: { params: item } },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        await db.query('SELECT app.revoke_followup_attachment($1)', [req.params.id]);
        return { ok: true };
      }),
  );
  app.put<{ Params: P }>(
    root + '/attachments/:id/upload',
    {
      bodyLimit: 20971520,
      schema: { params: item },
      onRequest: async (req) => {
        req.raw.setTimeout?.(60000, () => req.raw.destroy());
        if (req.headers['content-type'] !== 'application/octet-stream')
          throw problem(415, 'MEDIA_FORMAT', 'Usa la carga de archivo indicada.');
        await context(req, req.params.organizationId);
      },
      preParsing: async (_req, _reply, payload) => payload,
    },
    async (req) => {
      if (req.headers['content-type'] !== 'application/octet-stream')
        throw problem(415, 'MEDIA_FORMAT', 'Usa la carga de archivo indicada.');
      if (uploading) throw problem(429, 'MEDIA_QUEUE_FULL', 'Hay otra carga en curso.');
      uploading = true;
      let key: string | undefined,
        kept = false;
      try {
        return await run(req, req.params.organizationId, async (db) => {
          await db.query('SELECT pg_advisory_xact_lock_shared(70321021)');
          const token = randomUUID(),
            bytes = (
              await db.query('SELECT app.receive_followup_attachment($1,$2) bytes', [
                req.params.id,
                token,
              ])
            ).rows[0].bytes;
          const saved = await storage.putStream(req.body as Readable, bytes);
          key = saved.key;
          await db.query('SELECT app.finish_followup_upload($1,$2,$3,$4,$5)', [
            req.params.id,
            token,
            saved.key,
            saved.hash,
            saved.bytes,
          ]);
          return { ok: true };
        }).then((v) => {
          kept = true;
          return v;
        });
      } finally {
        uploading = false;
        if (key && !kept) await storage.remove(key).catch(() => {});
      }
    },
  );
  app.get<{ Params: P; Querystring: { poster?: string } }>(
    root + '/attachments/:id/file',
    {
      schema: {
        params: item,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { poster: { enum: ['1'], type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const data = await run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.followup_attachment_file($1,$2) data', [
              req.params.id,
              req.query.poster === '1',
            ])
          ).rows[0].data,
      );
      if (!data) throw problem(404, 'FOLLOWUP_NOT_FOUND', 'Adjunto no disponible.');
      const info = await storage.info(data.key).catch(() => {
        throw problem(404, 'MEDIA_NOT_FOUND', 'Archivo no disponible.');
      });
      reply
        .header('Content-Type', data.mime)
        .header('Cache-Control', 'private, no-store')
        .header('X-Content-Type-Options', 'nosniff')
        .header('Accept-Ranges', 'bytes');
      if (data.mime === 'application/pdf')
        reply
          .header('Content-Disposition', `attachment; filename="adjunto-${req.params.id}.pdf"`)
          .header('Content-Security-Policy', "sandbox; default-src 'none'");
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
  app.get<{ Params: P }>(
    root + '/threads/:id/resources',
    { schema: { params: item } },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        await check(db, req.params.id, true);
        return {
          versions: (
            await db.query(
              'SELECT v.id,r.name,v.number "number" FROM resource_versions v JOIN private_resources r ON r.id=v.resource_id WHERE app.followup_resource_shared($1,v.id) ORDER BY v.created_at DESC LIMIT 50',
              [req.params.id],
            )
          ).rows,
        };
      }),
  );
  app.get<{ Params: P }>(
    root + '/threads/:id/tracking',
    { schema: { params: item } },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        await check(db, req.params.id);
        await db.query('SELECT app.materialize_followup($1)', [req.params.id]);
        const allowed = (await db.query('SELECT app.followup_tracking($1) ok', [req.params.id]))
          .rows[0].ok;
        const habits = (
          await db.query(
            'SELECT id,document,starts_on::text "startsOn",ends_on::text "endsOn",cancelled,revision FROM followup_habits WHERE thread_id=$1 ORDER BY created_at DESC LIMIT 51',
            [req.params.id],
          )
        ).rows;
        const entries = allowed
          ? (
              await db.query(
                'SELECT e.habit_id "habitId",e.day_date::text AS "day",e.value::float8,e.note,e.revision FROM followup_habit_entries e JOIN followup_habits h ON h.id=e.habit_id WHERE h.thread_id=$1 AND e.day_date>=(now() AT TIME ZONE \'America/Asuncion\')::date-14 ORDER BY day_date DESC LIMIT 750',
                [req.params.id],
              )
            ).rows
          : [];
        const tasks = (
          await db.query(
            "SELECT t.id,t.schedule_id \"scheduleId\",t.scheduled_on::text \"scheduledOn\",t.closes_on::text \"closesOn\",t.cancelled,v.document,(SELECT jsonb_build_object('id',r.id,'revision',r.revision,'answers',r.answers,'declined',r.declined,'submittedAt',r.submitted_at,'review',r.review,'reviewedAt',r.reviewed_at) FROM followup_checkin_responses r WHERE r.task_id=t.id) response FROM followup_checkin_tasks t JOIN followup_checkin_schedules s ON s.id=t.schedule_id JOIN followup_checkin_versions v ON v.id=s.version_id WHERE s.thread_id=$1 AND t.scheduled_on BETWEEN (now() AT TIME ZONE 'America/Asuncion')::date-14 AND (now() AT TIME ZONE 'America/Asuncion')::date+31 ORDER BY t.scheduled_on DESC,t.id DESC LIMIT 101",
            [req.params.id],
          )
        ).rows;
        for (const t of tasks) {
          t.attachments = [];
          if (t.response)
            for (const f of t.document.fields)
              if (f.type === 'attachment' && t.response.answers[f.id]) {
                const a = await attachment(db, t.response.answers[f.id], req.params.organizationId);
                if (a) t.attachments.push(a);
              }
        }
        return {
          schedules: (
            await db.query(
              "SELECT s.id,v.document->>'name' name,s.frequency,s.revision,s.cancelled FROM followup_checkin_schedules s JOIN followup_checkin_versions v ON v.id=s.version_id WHERE s.thread_id=$1 ORDER BY s.created_at DESC LIMIT 50",
              [req.params.id],
            )
          ).rows,
          recordingAllowed: !!(
            await db.query('SELECT 1 FROM followup_reads WHERE thread_id=$1 AND tracking_consent', [
              req.params.id,
            ])
          ).rowCount,
          trackingAllowed: allowed,
          habits: habits.slice(0, 50),
          entries,
          tasks: tasks.slice(0, 100),
          templates: (
            await db.query(
              "SELECT id,document,revision FROM followup_checkin_templates ORDER BY document->>'name' LIMIT 50",
            )
          ).rows,
          truncated: habits.length > 50 || tasks.length > 100,
        };
      }),
  );
  app.post<{
    Params: P;
    Body: { id: string; document: unknown; startsOn: string; endsOn: string };
  }>(
    root + '/threads/:id/habits',
    {
      schema: {
        params: item,
        body: object({
          id: uuid,
          document: object({
            name: text(100, 2),
            kind: { enum: ['check', 'water', 'sleep', 'energy'] },
            target: number,
            weekdays: {
              ...array({ type: 'integer', minimum: 1, maximum: 7 }, 7),
              minItems: 1,
              uniqueItems: true,
            },
            instructions: text(1000),
          }),
          startsOn: date,
          endsOn: date,
        }),
      },
    },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        const b = req.body;
        return {
          id: (
            await db.query('SELECT app.assign_followup_habit($1,$2,$3,$4,$5) id', [
              b.id,
              req.params.id,
              b.document,
              b.startsOn,
              b.endsOn,
            ])
          ).rows[0].id,
        };
      }),
  );
  app.put<{
    Params: P;
    Body: { day: string; value: number | null; note: string; revision: number; requestId: string };
  }>(
    root + '/habits/:id/entry',
    {
      schema: {
        params: item,
        body: object({ day: date, value: number, note: text(500), revision, requestId: uuid }),
      },
    },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        const b = req.body;
        await db.query('SELECT app.save_followup_habit($1,$2,$3,$4,$5,$6)', [
          req.params.id,
          b.day,
          b.value,
          b.note,
          b.revision,
          b.requestId,
        ]);
        return { ok: true };
      }),
  );
  app.post<{ Params: P; Body: { kind: string; revision: number } }>(
    root + '/assignments/:id/cancel',
    { schema: { params: item, body: object({ kind: { enum: ['habit', 'checkin'] }, revision }) } },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        await db.query('SELECT app.cancel_followup_assignment($1,$2,$3)', [
          req.params.id,
          req.body.kind,
          req.body.revision,
        ]);
        return { ok: true };
      }),
  );
  app.put<{ Params: P; Body: { revision: number; document: unknown } }>(
    root + '/templates/:id',
    { bodyLimit: 32768, schema: { params: item, body: object({ revision, document }) } },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        await db.query('SELECT app.save_followup_template($1,$2,$3)', [
          req.params.id,
          req.body.document,
          req.body.revision,
        ]);
        return { ok: true };
      }),
  );
  app.post<{ Params: P; Body: { revision: number } }>(
    root + '/templates/:id/publish',
    { schema: { params: item, body: object({ revision }) } },
    async (req) =>
      run(req, req.params.organizationId, async (db) => ({
        id: (
          await db.query('SELECT app.publish_followup_template($1,$2) id', [
            req.params.id,
            req.body.revision,
          ])
        ).rows[0].id,
      })),
  );
  app.post<{
    Params: P;
    Body: {
      id: string;
      versionId: string;
      frequency: string;
      weekday: number;
      monthDay: number;
      windowDays: number;
      startsOn: string;
      endsOn: string;
    };
  }>(
    root + '/threads/:id/schedules',
    {
      schema: {
        params: item,
        body: object({
          id: uuid,
          versionId: uuid,
          frequency: { enum: ['weekly', 'monthly'] },
          weekday: { type: 'integer', minimum: 1, maximum: 7 },
          monthDay: { type: 'integer', minimum: 1, maximum: 31 },
          windowDays: { type: 'integer', minimum: 1, maximum: 14 },
          startsOn: date,
          endsOn: date,
        }),
      },
    },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        const b = req.body;
        return {
          id: (
            await db.query('SELECT app.schedule_followup_checkin($1,$2,$3,$4,$5,$6,$7,$8,$9) id', [
              b.id,
              req.params.id,
              b.versionId,
              b.frequency,
              b.weekday,
              b.monthDay,
              b.windowDays,
              b.startsOn,
              b.endsOn,
            ])
          ).rows[0].id,
        };
      }),
  );
  app.put<{
    Params: P;
    Body: { revision: number; requestId: string; answers: unknown; declined: boolean };
  }>(
    root + '/tasks/:id/response',
    {
      bodyLimit: 32768,
      schema: {
        params: item,
        body: object({
          revision,
          requestId: uuid,
          answers: {
            type: 'object',
            maxProperties: 12,
            additionalProperties: {
              type: ['string', 'number', 'boolean', 'null'],
              maxLength: 2000,
            },
          },
          declined: boolean,
        }),
      },
    },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        const b = req.body;
        return {
          id: (
            await db.query('SELECT app.respond_followup_checkin($1,$2,$3,$4,$5) id', [
              req.params.id,
              b.revision,
              b.requestId,
              b.answers,
              b.declined,
            ])
          ).rows[0].id,
        };
      }),
  );
  app.post<{ Params: P; Body: { requestId: string; review: string } }>(
    root + '/responses/:id/review',
    { schema: { params: item, body: object({ requestId: uuid, review: text(1000, 1) }) } },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        await db.query('SELECT app.review_followup_checkin($1,$2,$3)', [
          req.params.id,
          req.body.requestId,
          req.body.review,
        ]);
        return { ok: true };
      }),
  );
  await registerFollowupRealtime(app, options);
}
