import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import {
  measurementKinds,
  validMeasurement,
  type CurrentUser,
  type OrganizationSummary,
  type BodyMeasurement,
  type ProgressPhoto,
} from '@forma/shared';
import { actorTransaction } from './organizations.js';
import { PrivateStorage } from './storage.js';
import type { AppConfig } from './app.js';
import { problem } from './problems.js';
interface Options {
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
  root = '/v1/organizations/:organizationId/progress',
  params = {
    type: 'object',
    required: ['organizationId', 'studentId'],
    properties: { organizationId: uuid, studentId: uuid },
  },
  itemParams = {
    ...params,
    required: [...params.required, 'id'],
    properties: { ...params.properties, id: uuid },
  },
  object = (properties: Record<string, unknown>) => ({
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  });
const studentRoot = root + '/:studentId';
function validDate(s: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    s >= '2000-01-01' &&
    s <= '2100-01-01' &&
    Number.isFinite(Date.parse(s + 'T12:00:00Z')) &&
    new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s
  );
}
function rawSettings(request: FastifyRequest) {
  const b = request.body as {
    revision?: unknown;
    photoConsent?: unknown;
    professionals?: unknown;
    days?: unknown;
    enabled?: unknown;
  } | null;
  if (!b || !Number.isInteger(b.revision) || (b.revision as number) < 0)
    throw problem(400, 'INVALID_PROGRESS', 'Actualiza y revisa la configuración.');
  if (request.url.endsWith('/privacy')) {
    if (
      typeof b.photoConsent !== 'boolean' ||
      !Array.isArray(b.professionals) ||
      !b.professionals.every(
        (p) =>
          p &&
          typeof p.id === 'string' &&
          typeof p.measurements === 'boolean' &&
          typeof p.photos === 'boolean',
      )
    )
      throw problem(400, 'INVALID_PROGRESS', 'Revisa los permisos.');
  } else if (typeof b.enabled !== 'boolean' || !Number.isInteger(b.days))
    throw problem(400, 'INVALID_PROGRESS', 'Revisa el aviso.');
}
function measurementDTO(r: Record<string, unknown>): BodyMeasurement {
  return {
    id: String(r.id),
    kind: r.kind as BodyMeasurement['kind'],
    value: Number(r.value),
    unit: measurementKinds[r.kind as BodyMeasurement['kind']].unit,
    measuredOn: String(r.day_date),
    source: r.source as BodyMeasurement['source'],
    createdBy: String(r.created_by),
    createdAt: (r.created_at as Date).toISOString(),
    voidedAt: (r.voided_at as Date | null)?.toISOString() ?? null,
    voidReason: r.void_reason as string | null,
    correctionOf: r.correction_of as string | null,
  };
}
function photoDTO(r: Record<string, unknown>, org: string, student: string): ProgressPhoto {
  const base = `/v1/organizations/${org}/progress/${student}/photos/${r.id}/file`;
  return {
    id: String(r.id),
    measuredOn: String(r.day_date),
    caption: String(r.caption),
    width: Number(r.width),
    height: Number(r.height),
    url: base,
    thumbnailUrl: base + '?variant=thumbnail',
    createdAt: (r.created_at as Date).toISOString(),
  };
}
export async function registerProgress(app: FastifyInstance, { pool, context, config }: Options) {
  const storage = new PrivateStorage(
    config.storageRoot ?? process.env.STORAGE_PATH ?? '.local/storage',
    2097152,
  );
  let activePhotos = 0;
  async function access(db: PoolClient, student: string, kind: string) {
    if (
      !(await db.query('SELECT app.progress_access($1,$2) allowed', [student, kind])).rows[0]
        .allowed
    )
      throw problem(403, 'PROGRESS_PRIVATE', 'El alumno no ha compartido estos datos contigo.');
  }
  app.get<{
    Params: { organizationId: string; studentId: string };
    Querystring: { from: string; to: string; exerciseId?: string };
  }>(
    studentRoot,
    {
      schema: {
        params,
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['from', 'to'],
          properties: { from: date, to: date, exerciseId: uuid },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId),
        q = request.query;
      if (!validDate(q.from) || !validDate(q.to))
        throw problem(400, 'INVALID_PROGRESS', 'Revisa las fechas del periodo.');
      return actorTransaction(pool, user.id, org.id, async (db) => ({
        metrics: (
          await db.query('SELECT app.progress_metrics($1,$2,$3,$4) data', [
            request.params.studentId,
            q.from,
            q.to,
            q.exerciseId ?? null,
          ])
        ).rows[0].data,
      }));
    },
  );
  app.get<{
    Params: { organizationId: string };
    Querystring: { q?: string; cursor?: string; limit?: number };
  }>(
    root,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            q: { type: 'string', maxLength: 100 },
            cursor: uuid,
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
          'owner',
          'coach',
        ]),
        limit = request.query.limit ?? 20;
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const rows = (
          await db.query(
            `WITH chosen AS MATERIALIZED(SELECT id,display_name,status,created_at FROM students WHERE organization_id=$1 AND app.can_manage_student(organization_id,id) AND ($2='' OR display_name ILIKE '%'||$2||'%') AND ($3::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM students WHERE id=$3 AND organization_id=$1)) ORDER BY created_at DESC,id DESC LIMIT $4),completed AS MATERIALIZED(SELECT s.id,s.student_id,s.completed_at,s.scheduled_on FROM workout_sessions s JOIN chosen c ON c.id=s.student_id WHERE s.organization_id=$1 AND s.state='completed' AND EXISTS(SELECT 1 FROM workout_sets r WHERE r.organization_id=$1 AND r.session_id=s.id AND r.state='recorded')),totals AS(SELECT student_id,max(completed_at) last_completed,count(*)FILTER(WHERE scheduled_on BETWEEN (now() AT TIME ZONE 'America/Asuncion')::date-27 AND (now() AT TIME ZONE 'America/Asuncion')::date) sessions FROM completed GROUP BY student_id),volume AS(SELECT s.student_id,coalesce(sum(r.weight_kg*r.reps)FILTER(WHERE r.metric='reps' AND r.state='recorded' AND r.weight_kg IS NOT NULL),0) value FROM completed s JOIN workout_sets r ON r.organization_id=$1 AND r.session_id=s.id WHERE s.scheduled_on BETWEEN (now() AT TIME ZONE 'America/Asuncion')::date-27 AND (now() AT TIME ZONE 'America/Asuncion')::date GROUP BY s.student_id)SELECT c.*,t.last_completed,coalesce(t.sessions,0) sessions,coalesce(v.value,0) volume,coalesce(a.days,14) threshold,coalesce(a.enabled,true) enabled,coalesce(a.revision,0) revision,greatest(0,(now() AT TIME ZONE 'America/Asuncion')::date-coalesce((t.last_completed AT TIME ZONE 'America/Asuncion')::date,(c.created_at AT TIME ZONE 'America/Asuncion')::date)) inactive FROM chosen c LEFT JOIN totals t ON t.student_id=c.id LEFT JOIN volume v ON v.student_id=c.id LEFT JOIN progress_alert_settings a ON a.organization_id=$1 AND a.student_id=c.id AND a.professional_user_id=$5 ORDER BY c.created_at DESC,c.id DESC`,
            [org.id, request.query.q ?? '', request.query.cursor ?? null, limit + 1, user.id],
          )
        ).rows;
        return {
          students: rows.slice(0, limit).map((r) => ({
            id: r.id,
            name: r.display_name,
            status: r.status,
            sessions: Number(r.sessions),
            volumeKgReps: Number(r.volume),
            activity: {
              lastCompletedAt: r.last_completed?.toISOString() ?? null,
              daysInactive: r.inactive,
              enabled: r.enabled,
              thresholdDays: r.threshold,
              revision: r.revision,
              flagged: r.status === 'active' && r.enabled && r.inactive >= r.threshold,
            },
          })),
          nextCursor: rows.length > limit ? rows[limit - 1].id : null,
        };
      });
    },
  );
  app.get<{ Params: { organizationId: string; studentId: string } }>(
    studentRoot + '/privacy',
    { schema: { params } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, ['student']);
      return actorTransaction(pool, user.id, org.id, async (db) => ({
        privacy: (
          await db.query('SELECT app.progress_privacy($1) data', [request.params.studentId])
        ).rows[0].data,
      }));
    },
  );
  app.put<{
    Params: { organizationId: string; studentId: string };
    Body: {
      revision: number;
      photoConsent: boolean;
      professionals: { id: string; measurements: boolean; photos: boolean }[];
    };
  }>(
    studentRoot + '/privacy',
    {
      preValidation: async (request) => rawSettings(request),
      schema: {
        params,
        body: object({
          revision: { type: 'integer', minimum: 0 },
          photoConsent: { type: 'boolean' },
          professionals: {
            type: 'array',
            maxItems: 50,
            items: object({
              id: uuid,
              measurements: { type: 'boolean' },
              photos: { type: 'boolean' },
            }),
          },
        }),
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, ['student']),
        b = request.body;
      return actorTransaction(pool, user.id, org.id, async (db) => ({
        privacy: (
          await db.query('SELECT app.set_progress_privacy($1,$2,$3,$4) data', [
            request.params.studentId,
            b.revision,
            b.photoConsent,
            JSON.stringify(b.professionals),
          ])
        ).rows[0].data,
      }));
    },
  );
  app.put<{
    Params: { organizationId: string; studentId: string };
    Body: { revision: number; days: number; enabled: boolean };
  }>(
    studentRoot + '/alert',
    {
      preValidation: async (request) => rawSettings(request),
      schema: {
        params,
        body: object({
          revision: { type: 'integer', minimum: 0 },
          days: { type: 'integer', minimum: 7, maximum: 90 },
          enabled: { type: 'boolean' },
        }),
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
          'owner',
          'coach',
        ]),
        b = request.body;
      await actorTransaction(pool, user.id, org.id, (db) =>
        db.query('SELECT app.set_progress_alert($1,$2,$3,$4)', [
          request.params.studentId,
          b.days,
          b.enabled,
          b.revision,
        ]),
      );
      return { success: true };
    },
  );
  app.get<{
    Params: { organizationId: string; studentId: string };
    Querystring: { kind?: string; from?: string; to?: string; cursor?: string; limit?: number };
  }>(
    studentRoot + '/measurements',
    {
      schema: {
        params,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            kind: { type: 'string', enum: Object.keys(measurementKinds) },
            from: date,
            to: date,
            cursor: uuid,
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId),
        q = request.query,
        limit = q.limit ?? 50;
      if ((q.from && !validDate(q.from)) || (q.to && !validDate(q.to)))
        throw problem(400, 'INVALID_PROGRESS', 'Revisa las fechas.');
      return actorTransaction(pool, user.id, org.id, async (db) => {
        await access(db, request.params.studentId, 'measurements');
        const rows = (
          await db.query(
            'SELECT m.*,m.measured_on::text AS day_date FROM body_measurements m WHERE organization_id=$1 AND student_id=$2 AND ($3::text IS NULL OR kind=$3) AND ($4::date IS NULL OR measured_on>=$4) AND ($5::date IS NULL OR measured_on<=$5) AND ($6::uuid IS NULL OR (measured_on,id)<(SELECT measured_on,id FROM body_measurements WHERE id=$6 AND organization_id=$1 AND student_id=$2)) ORDER BY measured_on DESC,id DESC LIMIT $7',
            [
              org.id,
              request.params.studentId,
              q.kind ?? null,
              q.from ?? null,
              q.to ?? null,
              q.cursor ?? null,
              limit + 1,
            ],
          )
        ).rows;
        return {
          measurements: rows.slice(0, limit).map(measurementDTO),
          nextCursor: rows.length > limit ? rows[limit - 1].id : null,
        };
      });
    },
  );
  app.post<{
    Params: { organizationId: string; studentId: string };
    Body: { kind: string; value: number; measuredOn: string; requestId: string };
  }>(
    studentRoot + '/measurements',
    {
      preValidation: async (request) => {
        let valid = false;
        try {
          valid = validMeasurement(request.body);
        } catch {
          /* malformed date */
        }
        if (!valid)
          throw problem(
            400,
            'INVALID_PROGRESS',
            'Indica un valor positivo y una fecha válida con su unidad.',
          );
      },
      schema: { params },
    },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId),
        b = request.body;
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const id = (
          await db.query('SELECT app.record_measurement($1,$2,$3,$4,$5) id', [
            request.params.studentId,
            b.requestId,
            b.kind,
            b.value,
            b.measuredOn,
          ])
        ).rows[0].id;
        const row = (
          await db.query(
            'SELECT m.*,m.measured_on::text AS day_date FROM body_measurements m WHERE id=$1',
            [id],
          )
        ).rows[0];
        reply.code(201);
        return { measurement: measurementDTO(row) };
      });
    },
  );
  app.post<{
    Params: { organizationId: string; studentId: string; id: string };
    Body: { reason: string };
  }>(
    studentRoot + '/measurements/:id/void',
    {
      schema: {
        params: itemParams,
        body: object({ reason: { type: 'string', minLength: 3, maxLength: 200 } }),
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      await actorTransaction(pool, user.id, org.id, async (db) => {
        const r = (
          await db.query('SELECT student_id FROM body_measurements WHERE id=$1', [
            request.params.id,
          ])
        ).rows[0];
        if (!r || r.student_id !== request.params.studentId)
          throw problem(404, 'PROGRESS_NOT_FOUND', 'No se encontró la medición.');
        await db.query('SELECT app.void_measurement($1,$2)', [
          request.params.id,
          request.body.reason,
        ]);
      });
      return { success: true };
    },
  );
  app.post<{
    Params: { organizationId: string; studentId: string; id: string };
    Body: { value: number; measuredOn: string; reason: string; requestId: string };
  }>(
    studentRoot + '/measurements/:id/correct',
    {
      schema: {
        params: itemParams,
        body: object({
          value: { type: 'number', exclusiveMinimum: 0, maximum: 500 },
          measuredOn: date,
          reason: { type: 'string', minLength: 3, maxLength: 200 },
          requestId: uuid,
        }),
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      if (!validDate(request.body.measuredOn))
        throw problem(400, 'INVALID_PROGRESS', 'Revisa la fecha.');
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const current = (
          await db.query('SELECT student_id FROM body_measurements WHERE id=$1', [
            request.params.id,
          ])
        ).rows[0];
        if (!current || current.student_id !== request.params.studentId)
          throw problem(404, 'PROGRESS_NOT_FOUND', 'No se encontró la medición.');
        const id = (
          await db.query('SELECT app.correct_measurement($1,$2,$3,$4,$5) id', [
            request.params.id,
            request.body.requestId,
            request.body.value,
            request.body.measuredOn,
            request.body.reason,
          ])
        ).rows[0].id;
        const measurement = (
          await db.query(
            'SELECT m.*,m.measured_on::text AS day_date FROM body_measurements m WHERE id=$1',
            [id],
          )
        ).rows[0];
        return { measurement: measurementDTO(measurement) };
      });
    },
  );
  app.get<{
    Params: { organizationId: string; studentId: string };
    Querystring: { kind: string; from: string; to: string };
  }>(
    studentRoot + '/measurements/trend',
    {
      schema: {
        params,
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'from', 'to'],
          properties: {
            kind: { type: 'string', enum: Object.keys(measurementKinds) },
            from: date,
            to: date,
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId),
        q = request.query;
      if (
        !validDate(q.from) ||
        !validDate(q.to) ||
        q.from > q.to ||
        Date.parse(q.to) - Date.parse(q.from) > 365 * 86400000
      )
        throw problem(400, 'INVALID_PROGRESS', 'Selecciona hasta 366 días.');
      return actorTransaction(pool, user.id, org.id, async (db) => {
        await access(db, request.params.studentId, 'measurements');
        const rows = (
          await db.query(
            'SELECT day_date,value FROM(SELECT DISTINCT ON(measured_on) measured_on,measured_on::text day_date,value FROM body_measurements WHERE organization_id=$1 AND student_id=$2 AND kind=$3 AND measured_on BETWEEN $4::date AND $5::date AND voided_at IS NULL ORDER BY measured_on DESC,created_at DESC,id DESC)m ORDER BY measured_on',
            [org.id, request.params.studentId, q.kind, q.from, q.to],
          )
        ).rows;
        return { points: rows.map((r) => ({ date: r.day_date, value: Number(r.value) })) };
      });
    },
  );
  app.get<{
    Params: { organizationId: string; studentId: string };
    Querystring: { cursor?: string; limit?: number };
  }>(
    studentRoot + '/photos',
    {
      schema: {
        params,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            cursor: uuid,
            limit: { type: 'integer', minimum: 1, maximum: 30, default: 12 },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId),
        limit = request.query.limit ?? 12;
      return actorTransaction(pool, user.id, org.id, async (db) => {
        await access(db, request.params.studentId, 'photos');
        const rows = (
          await db.query(
            'SELECT p.*,p.measured_on::text AS day_date FROM progress_photos p WHERE organization_id=$1 AND student_id=$2 AND deleted_at IS NULL AND ($3::uuid IS NULL OR (measured_on,id)<(SELECT measured_on,id FROM progress_photos WHERE id=$3 AND organization_id=$1 AND student_id=$2)) ORDER BY measured_on DESC,id DESC LIMIT $4',
            [org.id, request.params.studentId, request.query.cursor ?? null, limit + 1],
          )
        ).rows;
        return {
          photos: rows.slice(0, limit).map((r) => photoDTO(r, org.id, request.params.studentId)),
          nextCursor: rows.length > limit ? rows[limit - 1].id : null,
        };
      });
    },
  );
  app.post<{
    Params: { organizationId: string; studentId: string };
    Body: { requestId: string; measuredOn: string; caption: string; dataUrl: string };
  }>(
    studentRoot + '/photos',
    {
      bodyLimit: 2900000,
      onRequest: async (request) => {
        await context(request, (request.params as { organizationId: string }).organizationId, [
          'student',
        ]);
      },
      schema: {
        params,
        body: object({
          requestId: uuid,
          measuredOn: date,
          caption: { type: 'string', maxLength: 200 },
          dataUrl: { type: 'string', maxLength: 2800000 },
        }),
      },
    },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId, ['student']),
        b = request.body,
        student = request.params.studentId;
      if (!validDate(b.measuredOn)) throw problem(400, 'INVALID_PROGRESS', 'Revisa la fecha.');
      await actorTransaction(pool, user.id, org.id, async (db) => {
        if (!(await db.query('SELECT app.progress_self($1) allowed', [student])).rows[0].allowed)
          throw problem(403, 'FORBIDDEN', 'Solo puedes subir tus propias fotos.');
        await access(db, student, 'photos');
      });
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.dataUrl);
      if (!match) throw problem(400, 'INVALID_PHOTO', 'Sube PNG, JPEG o WebP de hasta 2 MB.');
      const input = Buffer.from(match[2]!, 'base64');
      if (input.length > 2097152 || !input.length)
        throw problem(413, 'INVALID_PHOTO', 'La imagen supera 2 MB.');
      const hash = createHash('sha256').update(input).digest('hex');
      const previous = await actorTransaction(
        pool,
        user.id,
        org.id,
        async (db) =>
          (
            await db.query(
              'SELECT p.*,p.measured_on::text AS day_date FROM progress_photos p WHERE organization_id=$1 AND student_id=$2 AND request_id=$3',
              [org.id, student, b.requestId],
            )
          ).rows[0],
      );
      if (previous) {
        if (
          previous.source_hash !== hash ||
          previous.day_date !== b.measuredOn ||
          previous.caption !== b.caption
        )
          throw problem(409, 'IDEMPOTENCY_CONFLICT', 'La solicitud ya corresponde a otra foto.');
        return { photo: photoDTO(previous, org.id, student) };
      }
      if (activePhotos >= 2)
        throw problem(429, 'PHOTO_BUSY', 'Espera un momento y vuelve a subir la foto.');
      activePhotos++;
      let full: Buffer, thumb: Buffer, width: number, height: number;
      try {
        const metadata = await sharp(input, {
          limitInputPixels: 8388608,
          animated: false,
        }).metadata();
        if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1)
          throw new Error('format');
        const result = await sharp(input, { limitInputPixels: 8388608, animated: false })
          .timeout({ seconds: 5 })
          .rotate()
          .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer({ resolveWithObject: true });
        full = result.data;
        width = result.info.width;
        height = result.info.height;
        thumb = await sharp(full)
          .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer();
        if (full.length + thumb.length > 2097152) throw new Error('size');
      } catch {
        throw problem(
          400,
          'INVALID_PHOTO',
          'No pudimos leer esa imagen. Usa una imagen sin animación y de hasta 8 megapíxeles.',
        );
      } finally {
        activePhotos--;
      }
      const keys: string[] = [];
      let stored = false;
      let keptKey: string | undefined;
      try {
        const result = await actorTransaction(pool, user.id, org.id, async (db) => {
          await db.query('SELECT pg_advisory_xact_lock_shared(70321021)');
          keys.push(await storage.put(full, 'webp'));
          keys.push(await storage.put(thumb, 'webp'));
          const id = (
            await db.query('SELECT app.save_progress_photo($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) id', [
              student,
              b.requestId,
              hash,
              b.measuredOn,
              b.caption,
              keys[0],
              keys[1],
              full.length + thumb.length,
              width,
              height,
            ])
          ).rows[0].id;
          const row = (
            await db.query(
              'SELECT p.*,p.measured_on::text AS day_date FROM progress_photos p WHERE id=$1',
              [id],
            )
          ).rows[0];
          if (!row)
            throw problem(
              409,
              'PROGRESS_PHOTO_REMOVED',
              'Esta foto ya se eliminó. No se puede recuperar reintentando la subida.',
            );
          keptKey = row.storage_key;
          reply.code(201);
          return { photo: photoDTO(row, org.id, student) };
        });
        stored = keptKey === keys[0];
        return result;
      } finally {
        if (!stored) for (const key of keys) await storage.remove(key).catch(() => {});
      }
    },
  );
  app.delete<{ Params: { organizationId: string; studentId: string; id: string } }>(
    studentRoot + '/photos/:id',
    { schema: { params: itemParams } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, ['student']);
      await actorTransaction(pool, user.id, org.id, async (db) => {
        const r = (
          await db.query('SELECT student_id FROM progress_photos WHERE id=$1', [request.params.id])
        ).rows[0];
        if (!r || r.student_id !== request.params.studentId)
          throw problem(404, 'PROGRESS_NOT_FOUND', 'No se encontró la foto.');
        await db.query('SELECT app.delete_progress_photo($1)', [request.params.id]);
      });
      return { success: true };
    },
  );
  app.get<{
    Params: { organizationId: string; studentId: string; id: string };
    Querystring: { variant?: 'thumbnail' };
  }>(
    studentRoot + '/photos/:id/file',
    {
      schema: {
        params: itemParams,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { variant: { type: 'string', enum: ['thumbnail'] } },
        },
      },
    },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId);
      const row = await actorTransaction(
        pool,
        user.id,
        org.id,
        async (db) =>
          (
            await db.query(
              'SELECT storage_key,thumbnail_key FROM progress_photos WHERE organization_id=$1 AND student_id=$2 AND id=$3 AND deleted_at IS NULL',
              [org.id, request.params.studentId, request.params.id],
            )
          ).rows[0],
      );
      if (!row) throw problem(404, 'PROGRESS_NOT_FOUND', 'No se encontró la foto.');
      let bytes: Buffer;
      try {
        bytes = await storage.read(
          request.query.variant === 'thumbnail' ? row.thumbnail_key : row.storage_key,
        );
      } catch {
        throw problem(404, 'PROGRESS_NOT_FOUND', 'La imagen no está disponible.');
      }
      return reply
        .header('Cache-Control', 'private, no-store')
        .header('Content-Type', 'image/webp')
        .header('Content-Disposition', 'inline; filename="progress.webp"')
        .send(bytes);
    },
  );
}
