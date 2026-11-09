import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type { Readable } from 'node:stream';
import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type {
  CurrentUser,
  OrganizationSummary,
  MediaAsset,
  LibraryExercise,
  StudioEquipment,
} from '@forma/shared';
import type { AppConfig } from './app.js';
import { actorTransaction } from './organizations.js';
import { PrivateStorage } from './storage.js';
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
interface MediaRow {
  id: string;
  kind: MediaAsset['kind'];
  state: MediaAsset['state'];
  input_bytes: string | number;
  output_bytes: string | number;
  poster_bytes: string | number;
  duration_seconds: string | null;
  width: number | null;
  height: number | null;
  operation_version: number;
  error_code: string | null;
  created_at: Date | string;
  processing_ms: number | null;
  output_key: string | null;
  poster_key: string | null;
  mime_type: string | null;
}
interface ExerciseRow {
  visual_key: string | null;
  id: string;
  organization_id: string | null;
  name: string;
  instructions: string;
  muscle: string;
  equipment_tag: string;
  metric: LibraryExercise['metric'];
  variations: string[];
  tags: string[];
  state: LibraryExercise['state'];
  version: number;
  equipment_id: string | null;
  equipment_name: string | null;
  media_id: string | null;
  media: MediaRow | null;
  created_at: Date;
}
interface EquipmentRow {
  id: string;
  name: string;
  description: string;
  location: string;
  state: StudioEquipment['state'];
  photo_id: string | null;
  photo: MediaRow | null;
  version: number;
}
interface ExerciseInput {
  visualKey?: string | null;
  name: string;
  instructions: string;
  muscle: string;
  equipmentTag: string;
  metric: LibraryExercise['metric'];
  variations: string[];
  tags: string[];
  state: LibraryExercise['state'];
  equipmentId: string | null;
  mediaId: string | null;
  version?: number;
}
interface EquipmentInput {
  name: string;
  description: string;
  location: string;
  state: StudioEquipment['state'];
  photoId: string | null;
  version?: number;
}
export function mediaDTO(row: MediaRow, org: string): MediaAsset {
  const ready = row.state === 'ready';
  return {
    id: row.id,
    kind: row.kind,
    state: row.state,
    bytes: Number(row.input_bytes) + Number(row.output_bytes) + Number(row.poster_bytes),
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    width: row.width,
    height: row.height,
    version: row.operation_version,
    errorCode: row.error_code,
    createdAt: new Date(row.created_at).toISOString(),
    url: ready ? `/v1/organizations/${org}/media/${row.id}/file?v=${row.operation_version}` : null,
    posterUrl: ready
      ? `/v1/organizations/${org}/media/${row.id}/file?variant=poster&v=${row.operation_version}`
      : null,
    processingMs: row.processing_ms,
  };
}
const uuid = {
  type: 'string',
  pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
} as const;
const orgParams = {
  type: 'object',
  required: ['organizationId'],
  properties: { organizationId: uuid },
} as const;
const itemParams = {
  type: 'object',
  required: ['organizationId', 'id'],
  properties: { ...orgParams.properties, id: uuid },
} as const;
const nullableId = { anyOf: [uuid, { type: 'null' }] };
const text = (max: number, min = 0) => ({ type: 'string', minLength: min, maxLength: max });
const exerciseFields = {
  visualKey: {
    type: ['string', 'null'],
    enum: [
      null,
      'bench',
      'squat',
      'hinge',
      'row',
      'overhead',
      'lunge',
      'pullup',
      'curl',
      'pulldown',
      'plank',
      'bike',
      'pushup',
      'fly',
      'dip',
      'legpress',
      'legextension',
      'legcurl',
      'hipthrust',
      'calf',
      'lateralraise',
      'triceps',
      'crunch',
      'rope',
      'treadmill',
      'elliptical',
    ],
  },
  name: text(100, 2),
  instructions: text(5000, 10),
  muscle: text(60, 2),
  equipmentTag: text(60),
  metric: { type: 'string', enum: ['reps', 'time', 'distance'] },
  variations: { type: 'array', maxItems: 8, items: text(80, 1) },
  tags: { type: 'array', maxItems: 8, items: text(40, 1) },
  state: { type: 'string', enum: ['draft', 'published', 'archived'] },
  equipmentId: nullableId,
  mediaId: nullableId,
};
const equipmentFields = {
  name: text(100, 2),
  description: text(1000),
  location: text(100),
  state: { type: 'string', enum: ['available', 'maintenance', 'archived'] },
  photoId: nullableId,
};
const bodySchema = (fields: Record<string, unknown>, update = false) => ({
  type: 'object',
  additionalProperties: false,
  required: [
    ...Object.keys(fields).filter((key) => key !== 'visualKey'),
    ...(update ? ['version'] : []),
  ],
  properties: { ...fields, ...(update ? { version: { type: 'integer', minimum: 1 } } : {}) },
});
const listQuery = {
  type: 'object',
  additionalProperties: false,
  properties: {
    q: text(100),
    muscle: text(60),
    origin: { type: 'string', enum: ['all', 'own', 'global'] },
    state: { type: 'string', enum: ['all', 'draft', 'published', 'archived'] },
    equipmentId: uuid,
    cursor: uuid,
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
  },
};
const exerciseSelect =
  'SELECT e.*,q.name equipment_name,row_to_json(m) media FROM exercises e LEFT JOIN equipment q ON q.organization_id=e.organization_id AND q.id=e.equipment_id LEFT JOIN media_assets m ON m.organization_id=e.organization_id AND m.id=e.media_id';
const equipmentSelect =
  'SELECT e.*,row_to_json(m) photo FROM equipment e LEFT JOIN media_assets m ON m.organization_id=e.organization_id AND m.id=e.photo_id';

export async function registerLibrary(app: FastifyInstance, { pool, config, context }: Options) {
  const storage = new PrivateStorage(
    config.storageRoot ?? process.env.STORAGE_PATH ?? '.local/storage',
    20 * 1024 * 1024,
  );
  const root = '/v1/organizations/:organizationId';
  const exerciseDTO = (e: ExerciseRow, org: string): LibraryExercise => ({
    id: e.id,
    name: e.name,
    instructions: e.instructions,
    visualKey: e.visual_key,
    muscle: e.muscle,
    equipmentTag: e.equipment_tag,
    metric: e.metric,
    variations: e.variations,
    tags: e.tags,
    state: e.state,
    version: e.version,
    global: e.organization_id === null,
    equipmentId: e.equipment_id,
    equipmentName: e.equipment_name,
    mediaId: e.media_id,
    media: e.media ? mediaDTO(e.media, org) : null,
    createdAt: new Date(e.created_at).toISOString(),
  });
  const equipmentDTO = (e: EquipmentRow, org: string): StudioEquipment => ({
    id: e.id,
    name: e.name,
    description: e.description,
    location: e.location,
    state: e.state,
    photoId: e.photo_id,
    photo: e.photo ? mediaDTO(e.photo, org) : null,
    version: e.version,
  });
  async function checkMedia(db: PoolClient, id: string | null, kind?: string) {
    if (!id) return;
    const row = (
      await db.query<MediaRow>(
        "SELECT * FROM media_assets WHERE id=$1 AND organization_id=app.tenant() AND state IN ('pending','processing','ready')",
        [id],
      )
    ).rows[0];
    if (!row || (kind && row.kind !== kind))
      throw problem(400, 'INVALID_REFERENCE', 'El medio no está disponible en este estudio.');
  }
  async function checkEquipment(db: PoolClient, id: string | null) {
    if (
      id &&
      !(
        await db.query(
          "SELECT id FROM equipment WHERE id=$1 AND organization_id=app.tenant() AND state<>'archived'",
          [id],
        )
      ).rowCount
    )
      throw problem(400, 'INVALID_REFERENCE', 'Selecciona un equipo disponible de este estudio.');
  }
  async function audit(db: PoolClient, user: string, org: string, action: string, id: string) {
    await db.query(
      'INSERT INTO audit_logs(organization_id,actor_user_id,action,metadata)VALUES($1,$2,$3,$4)',
      [org, user, action, JSON.stringify({ id })],
    );
  }
  async function findExercise(db: PoolClient, id: string, org: string) {
    const row = (await db.query<ExerciseRow>(`${exerciseSelect} WHERE e.id=$1`, [id])).rows[0];
    if (!row) throw problem(404, 'EXERCISE_NOT_FOUND', 'No se encontró el ejercicio.');
    return exerciseDTO(row, org);
  }
  async function findEquipment(db: PoolClient, id: string, org: string) {
    const row = (
      await db.query<EquipmentRow>(`${equipmentSelect} WHERE e.id=$1 AND e.organization_id=$2`, [
        id,
        org,
      ])
    ).rows[0];
    if (!row) throw problem(404, 'EQUIPMENT_NOT_FOUND', 'No se encontró el equipo.');
    return equipmentDTO(row, org);
  }
  async function findMedia(db: PoolClient, id: string, org: string) {
    const row = (
      await db.query<MediaRow>('SELECT * FROM media_assets WHERE id=$1 AND organization_id=$2', [
        id,
        org,
      ])
    ).rows[0];
    if (!row) throw problem(404, 'MEDIA_NOT_FOUND', 'No se encontró el medio.');
    return row;
  }

  app.get<{
    Params: { organizationId: string };
    Querystring: {
      q?: string;
      muscle?: string;
      origin?: string;
      state?: string;
      equipmentId?: string;
      cursor?: string;
      limit?: number;
    };
  }>(
    `${root}/exercises`,
    { schema: { tags: ['library'], params: orgParams, querystring: listQuery } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const q = request.query;
        const limit = q.limit ?? 30;
        const rows = (
          await db.query<ExerciseRow>(
            `${exerciseSelect} WHERE ($1='' OR e.name ILIKE '%'||$1||'%' OR e.instructions ILIKE '%'||$1||'%' OR array_to_string(e.tags,' ') ILIKE '%'||$1||'%') AND ($2='' OR e.muscle=$2) AND ($3='all' OR ($3='global' AND e.organization_id IS NULL) OR ($3='own' AND e.organization_id=$8)) AND ($4='all' OR e.state=$4) AND ($5::uuid IS NULL OR e.equipment_id=$5) AND ($6::uuid IS NULL OR (e.created_at,e.id)<(SELECT created_at,id FROM exercises WHERE id=$6)) ORDER BY e.created_at DESC,e.id DESC LIMIT $7`,
            [
              q.q ?? '',
              q.muscle ?? '',
              q.origin ?? 'all',
              q.state ?? 'all',
              q.equipmentId ?? null,
              q.cursor ?? null,
              limit + 1,
              org.id,
            ],
          )
        ).rows;
        return {
          exercises: rows.slice(0, limit).map((row) => exerciseDTO(row, org.id)),
          nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
        };
      });
    },
  );
  app.get<{ Params: { organizationId: string; id: string } }>(
    `${root}/exercises/:id`,
    { schema: { tags: ['library'], params: itemParams } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      return actorTransaction(pool, user.id, org.id, async (db) => ({
        exercise: await findExercise(db, request.params.id, org.id),
      }));
    },
  );
  app.post<{ Params: { organizationId: string }; Body: ExerciseInput }>(
    `${root}/exercises`,
    { schema: { tags: ['library'], params: orgParams, body: bodySchema(exerciseFields) } },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      const b = request.body;
      return actorTransaction(pool, user.id, org.id, async (db) => {
        await checkMedia(db, b.mediaId);
        await checkEquipment(db, b.equipmentId);
        const id = (
          await db.query<{ id: string }>(
            'INSERT INTO exercises(organization_id,created_by,name,instructions,muscle,equipment_tag,metric,variations,tags,state,equipment_id,media_id,visual_key)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)RETURNING id',
            [
              org.id,
              user.id,
              b.name.trim(),
              b.instructions.trim(),
              b.muscle.trim(),
              b.equipmentTag.trim(),
              b.metric,
              b.variations,
              b.tags,
              b.state,
              b.equipmentId,
              b.mediaId,
              b.visualKey ?? null,
            ],
          )
        ).rows[0]!.id;
        await audit(db, user.id, org.id, 'exercise.created', id);
        reply.code(201);
        return { exercise: await findExercise(db, id, org.id) };
      });
    },
  );
  app.put<{ Params: { organizationId: string; id: string }; Body: ExerciseInput }>(
    `${root}/exercises/:id`,
    { schema: { tags: ['library'], params: itemParams, body: bodySchema(exerciseFields, true) } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      const b = request.body;
      return actorTransaction(pool, user.id, org.id, async (db) => {
        await checkMedia(db, b.mediaId);
        await checkEquipment(db, b.equipmentId);
        const existing = (
          await db.query<{ version: number; visual_key: string | null }>(
            'SELECT version,visual_key FROM exercises WHERE organization_id=$1 AND id=$2 FOR UPDATE',
            [org.id, request.params.id],
          )
        ).rows[0];
        if (!existing)
          throw problem(
            404,
            'EXERCISE_NOT_FOUND',
            'Solo puedes editar ejercicios propios de este estudio.',
          );
        if (existing.version !== b.version)
          throw problem(409, 'STALE_RECORD', 'El ejercicio cambió. Vuelve a abrir su ficha.');
        await db.query(
          'UPDATE exercises SET name=$1,instructions=$2,muscle=$3,equipment_tag=$4,metric=$5,variations=$6,tags=$7,state=$8,equipment_id=$9,media_id=$10,visual_key=$13,version=version+1,updated_at=clock_timestamp() WHERE organization_id=$11 AND id=$12',
          [
            b.name.trim(),
            b.instructions.trim(),
            b.muscle.trim(),
            b.equipmentTag.trim(),
            b.metric,
            b.variations,
            b.tags,
            b.state,
            b.equipmentId,
            b.mediaId,
            org.id,
            request.params.id,
            b.visualKey === undefined ? existing.visual_key : b.visualKey,
          ],
        );
        await audit(db, user.id, org.id, `exercise.${b.state}`, request.params.id);
        return { exercise: await findExercise(db, request.params.id, org.id) };
      });
    },
  );
  app.get<{ Params: { organizationId: string; id: string } }>(
    `${root}/exercises/:id/students`,
    { schema: { params: itemParams } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      return actorTransaction(pool, user.id, org.id, async (db) => ({
        students: (
          await db.query<{ student_id: string }>(
            'SELECT student_id FROM exercise_student_access WHERE organization_id=$1 AND exercise_id=$2',
            [org.id, request.params.id],
          )
        ).rows.map((row) => row.student_id),
      }));
    },
  );
  app.post<{ Params: { organizationId: string; id: string }; Body: { studentId: string } }>(
    `${root}/exercises/:id/students`,
    { schema: { tags: ['library'], params: itemParams, body: bodySchema({ studentId: uuid }) } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      await actorTransaction(pool, user.id, org.id, async (db) => {
        const exercise = await findExercise(db, request.params.id, org.id);
        if (exercise.global || exercise.state !== 'published')
          throw problem(
            409,
            'EXERCISE_NOT_PUBLISHED',
            'Publica un ejercicio propio antes de compartirlo.',
          );
        const can = (
          await db.query<{ allowed: boolean }>('SELECT app.can_manage_student($1,$2) allowed', [
            org.id,
            request.body.studentId,
          ])
        ).rows[0]!.allowed;
        if (!can) throw problem(404, 'STUDENT_NOT_FOUND', 'No se encontró el alumno.');
        await db.query(
          'INSERT INTO exercise_student_access(organization_id,exercise_id,student_id,granted_by)VALUES($1,$2,$3,$4)ON CONFLICT DO NOTHING',
          [org.id, exercise.id, request.body.studentId, user.id],
        );
        await audit(db, user.id, org.id, 'exercise.shared', exercise.id);
      });
      return { success: true };
    },
  );
  app.delete<{ Params: { organizationId: string; id: string; studentId: string } }>(
    `${root}/exercises/:id/students/:studentId`,
    {
      schema: {
        tags: ['library'],
        params: {
          type: 'object',
          required: ['organizationId', 'id', 'studentId'],
          properties: { ...itemParams.properties, studentId: uuid },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      await actorTransaction(pool, user.id, org.id, async (db) => {
        await db.query(
          'DELETE FROM exercise_student_access WHERE organization_id=$1 AND exercise_id=$2 AND student_id=$3',
          [org.id, request.params.id, request.params.studentId],
        );
        await audit(db, user.id, org.id, 'exercise.unshared', request.params.id);
      });
      return { success: true };
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { q?: string; cursor?: string; limit?: number };
  }>(
    `${root}/equipment`,
    {
      schema: {
        tags: ['library'],
        params: orgParams,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            q: text(100),
            cursor: uuid,
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const limit = request.query.limit ?? 50;
        const rows = (
          await db.query<EquipmentRow & { created_at: Date }>(
            `${equipmentSelect} WHERE ($1='' OR e.name ILIKE '%'||$1||'%' OR e.location ILIKE '%'||$1||'%' OR e.description ILIKE '%'||$1||'%') AND ($2::uuid IS NULL OR (e.created_at,e.id)<(SELECT created_at,id FROM equipment WHERE id=$2)) ORDER BY e.created_at DESC,e.id DESC LIMIT $3`,
            [request.query.q ?? '', request.query.cursor ?? null, limit + 1],
          )
        ).rows;
        return {
          equipment: rows.slice(0, limit).map((row) => equipmentDTO(row, org.id)),
          nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
        };
      });
    },
  );
  app.post<{ Params: { organizationId: string }; Body: EquipmentInput }>(
    `${root}/equipment`,
    { schema: { tags: ['library'], params: orgParams, body: bodySchema(equipmentFields) } },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      const b = request.body;
      return actorTransaction(pool, user.id, org.id, async (db) => {
        await checkMedia(db, b.photoId, 'image');
        const id = (
          await db.query<{ id: string }>(
            'INSERT INTO equipment(organization_id,name,description,location,state,photo_id)VALUES($1,$2,$3,$4,$5,$6)RETURNING id',
            [org.id, b.name.trim(), b.description.trim(), b.location.trim(), b.state, b.photoId],
          )
        ).rows[0]!.id;
        await audit(db, user.id, org.id, 'equipment.created', id);
        reply.code(201);
        return { equipment: await findEquipment(db, id, org.id) };
      });
    },
  );
  app.put<{ Params: { organizationId: string; id: string }; Body: EquipmentInput }>(
    `${root}/equipment/:id`,
    { schema: { tags: ['library'], params: itemParams, body: bodySchema(equipmentFields, true) } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      const b = request.body;
      return actorTransaction(pool, user.id, org.id, async (db) => {
        await checkMedia(db, b.photoId, 'image');
        const row = (
          await db.query<{ version: number }>(
            'SELECT version FROM equipment WHERE id=$1 AND organization_id=$2 FOR UPDATE',
            [request.params.id, org.id],
          )
        ).rows[0];
        if (!row) throw problem(404, 'EQUIPMENT_NOT_FOUND', 'No se encontró el equipo.');
        if (row.version !== b.version)
          throw problem(409, 'STALE_RECORD', 'El equipo cambió. Vuelve a abrir su ficha.');
        await db.query(
          'UPDATE equipment SET name=$1,description=$2,location=$3,state=$4,photo_id=$5,version=version+1,updated_at=clock_timestamp() WHERE id=$6 AND organization_id=$7',
          [
            b.name.trim(),
            b.description.trim(),
            b.location.trim(),
            b.state,
            b.photoId,
            request.params.id,
            org.id,
          ],
        );
        await audit(db, user.id, org.id, 'equipment.updated', request.params.id);
        return { equipment: await findEquipment(db, request.params.id, org.id) };
      });
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    `${root}/media/usage`,
    { schema: { tags: ['media'], params: orgParams } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const limits = (
          await db.query(
            'SELECT coalesce(l.storage_bytes,536870912) bytes,coalesce(l.video_seconds,1800) seconds FROM saas_subscriptions s LEFT JOIN media_plan_limits l ON l.plan_version_id=s.plan_version_id WHERE s.organization_id=$1',
            [org.id],
          )
        ).rows[0] ?? { bytes: 536870912, seconds: 1800 };
        const usage = (
          await db.query(
            "SELECT coalesce(sum(greatest(reserved_bytes,input_bytes+output_bytes+poster_bytes)),0) bytes,coalesce(sum(CASE WHEN kind='video' THEN coalesce(duration_seconds,CASE WHEN state IN ('reserved','uploading','pending','processing') THEN 60 ELSE 0 END) ELSE 0 END),0) seconds,count(*)FILTER(WHERE state IN ('reserved','uploading','pending','processing')) pending FROM media_assets WHERE organization_id=$1",
            [org.id],
          )
        ).rows[0];
        const online = (
          await db.query<{ online: boolean }>(
            "SELECT EXISTS(SELECT 1 FROM media_worker_heartbeats WHERE heartbeat_at>now()-interval '30 seconds' AND available) online",
          )
        ).rows[0]!.online;
        return {
          usage: {
            usedBytes:
              Number(usage.bytes) +
              Number(
                (
                  await db.query(
                    'SELECT coalesce(sum(byte_size),0)+app.progress_storage_used() bytes FROM organization_logo_assets WHERE organization_id=$1',
                    [org.id],
                  )
                ).rows[0].bytes,
              ),
            limitBytes: Number(limits.bytes),
            videoSeconds: Number(usage.seconds),
            limitSeconds: Number(limits.seconds),
            pending: Number(usage.pending),
            workerOnline: online,
          },
        };
      });
    },
  );
  app.get<{ Params: { organizationId: string }; Querystring: { cursor?: string; limit?: number } }>(
    `${root}/media`,
    {
      schema: {
        tags: ['media'],
        params: orgParams,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            cursor: uuid,
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const limit = request.query.limit ?? 50;
        const rows = (
          await db.query<MediaRow>(
            "SELECT * FROM media_assets WHERE organization_id=$1 AND state NOT IN ('cancelled','deleted') AND ($2::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM media_assets WHERE id=$2)) ORDER BY created_at DESC,id DESC LIMIT $3",
            [org.id, request.query.cursor ?? null, limit + 1],
          )
        ).rows;
        return {
          media: rows.slice(0, limit).map((row) => mediaDTO(row, org.id)),
          nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
        };
      });
    },
  );
  app.post<{
    Params: { organizationId: string };
    Body: { kind: 'image' | 'video'; bytes: number; requestId: string };
  }>(
    `${root}/media/uploads`,
    {
      schema: {
        tags: ['media'],
        params: orgParams,
        body: bodySchema({
          kind: { type: 'string', enum: ['image', 'video'] },
          bytes: { type: 'integer', minimum: 1, maximum: 20971520 },
          requestId: uuid,
        }),
      },
    },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const id = (
          await db.query<{ id: string }>('SELECT app.reserve_media($1,$2,$3) id', [
            request.body.kind,
            request.body.bytes,
            request.body.requestId,
          ])
        ).rows[0]!.id;
        reply.code(201);
        return { media: mediaDTO(await findMedia(db, id, org.id), org.id) };
      });
    },
  );
  app.addContentTypeParser('application/octet-stream', (_request, payload, done) =>
    done(null, payload),
  );
  app.put<{ Params: { organizationId: string; id: string }; Body: Readable }>(
    `${root}/media/:id/content`,
    {
      bodyLimit: 20971520,
      schema: { tags: ['media'], params: itemParams },
      onRequest: async (request) => {
        request.raw.setTimeout?.(60000, () => request.raw.destroy());
        if (request.headers['content-type'] !== 'application/octet-stream')
          throw problem(415, 'UPLOAD_FORMAT', 'Envía los bytes del archivo.');
        await context(request, request.params.organizationId, ['owner', 'coach']);
      },
    },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      const token = randomUUID();
      const expected = await actorTransaction(
        pool,
        user.id,
        org.id,
        async (db) =>
          (
            await db.query<{ bytes: number }>('SELECT app.receive_media($1,$2) bytes', [
              request.params.id,
              token,
            ])
          ).rows[0]!.bytes,
      );
      let key: string | undefined;
      try {
        const result = await storage.putStream(request.body, expected);
        key = result.key;
        await actorTransaction(pool, user.id, org.id, (db) =>
          db.query('SELECT app.finish_media_upload($1,$2,$3,$4,$5)', [
            request.params.id,
            token,
            result.key,
            result.hash,
            result.bytes,
          ]),
        );
        reply.code(202);
        return {
          media: await actorTransaction(pool, user.id, org.id, async (db) =>
            mediaDTO(await findMedia(db, request.params.id, org.id), org.id),
          ),
        };
      } catch (e) {
        if (key) await storage.remove(key).catch(() => {});
        await actorTransaction(pool, user.id, org.id, (db) =>
          db.query("SELECT app.media_action($1,'cancel')", [request.params.id]),
        ).catch(() => {});
        if (request.raw.aborted)
          throw problem(
            400,
            'UPLOAD_CANCELLED',
            'La carga se interrumpió. Selecciona el archivo de nuevo.',
          );
        if (e instanceof Error && /Storage limit|Incomplete upload/.test(e.message))
          throw problem(400, 'UPLOAD_SIZE', 'El tamaño recibido no coincide con la reserva.');
        throw e;
      }
    },
  );
  app.get<{ Params: { organizationId: string; id: string } }>(
    `${root}/media/:id`,
    { schema: { tags: ['media'], params: itemParams } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      return actorTransaction(pool, user.id, org.id, async (db) => ({
        media: mediaDTO(await findMedia(db, request.params.id, org.id), org.id),
      }));
    },
  );
  app.post<{ Params: { organizationId: string; id: string; action: string } }>(
    `${root}/media/:id/:action`,
    {
      schema: {
        tags: ['media'],
        params: {
          type: 'object',
          required: ['organizationId', 'id', 'action'],
          properties: {
            ...itemParams.properties,
            action: { type: 'string', enum: ['retry', 'cancel', 'delete'] },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      await actorTransaction(pool, user.id, org.id, (db) =>
        db.query('SELECT app.media_action($1,$2)', [request.params.id, request.params.action]),
      );
      return { success: true };
    },
  );
  app.get<{
    Params: { organizationId: string; id: string };
    Querystring: { variant?: string; v?: string };
  }>(
    `${root}/media/:id/file`,
    {
      schema: {
        tags: ['media'],
        params: itemParams,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { variant: { type: 'string', enum: ['poster'] }, v: text(20) },
        },
      },
    },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId);
      const asset = await actorTransaction(pool, user.id, org.id, (db) =>
        findMedia(db, request.params.id, org.id),
      );
      if (asset.state !== 'ready')
        throw problem(404, 'MEDIA_NOT_READY', 'El medio todavía no está disponible.');
      const poster = request.query.variant === 'poster';
      const key = poster ? asset.poster_key : asset.output_key;
      if (!key) throw problem(404, 'MEDIA_NOT_FOUND', 'No se encontró el archivo.');
      let info;
      try {
        info = await storage.info(key);
      } catch {
        throw problem(
          404,
          'MEDIA_UNAVAILABLE',
          'El archivo no está disponible. El texto de la guía sigue accesible.',
        );
      }
      reply
        .header(
          'Content-Type',
          poster ? (asset.kind === 'video' ? 'image/jpeg' : 'image/webp') : asset.mime_type!,
        )
        .header('Cache-Control', 'private, no-store')
        .header('Accept-Ranges', 'bytes')
        .header('Content-Disposition', 'inline');
      const range = request.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        let start: number,
          end = info.size - 1;
        if (match && (match[1] || match[2])) {
          if (match[1]) {
            start = Number(match[1]);
            if (match[2]) end = Math.min(Number(match[2]), end);
          } else start = Math.max(0, info.size - Number(match[2]));
        } else {
          reply.header('Content-Range', `bytes */${info.size}`);
          return reply.code(416).send();
        }
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start >= info.size ||
          start > end ||
          (Number(match[2]) === 0 && !match[1])
        ) {
          reply.header('Content-Range', `bytes */${info.size}`);
          return reply.code(416).send();
        }
        reply
          .code(206)
          .header('Content-Range', `bytes ${start}-${end}/${info.size}`)
          .header('Content-Length', end - start + 1);
        return createReadStream(info.path, { start, end });
      }
      reply.header('Content-Length', info.size);
      return createReadStream(info.path);
    },
  );
}
