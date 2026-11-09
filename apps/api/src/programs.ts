import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import {
  validateProgram,
  type ProgramDocument,
  type TrainingProgram,
  type ProgramVersion,
  type CurrentUser,
  type OrganizationSummary,
  type ProgramAssignment,
} from '@forma/shared';
import { actorTransaction } from './organizations.js';
import { mediaDTO } from './library.js';
import { problem } from './problems.js';
interface Options {
  pool: Pool;
  context: (
    request: FastifyRequest,
    id: string,
    roles?: string[],
  ) => Promise<{ user: CurrentUser; org: OrganizationSummary }>;
}
const uuid = {
  type: 'string',
  pattern: '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$',
};
const object = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
const text = (maxLength: number, minLength = 0) => ({ type: 'string', minLength, maxLength });
const list = (items: unknown, maxItems: number, minItems = 0) => ({
  type: 'array',
  items,
  minItems,
  maxItems,
});
const nullable = (minimum: number, maximum: number, integer = false) => ({
  type: [integer ? 'integer' : 'number', 'null'],
  minimum,
  maximum,
});
const series = object({
  id: uuid,
  repsMin: nullable(1, 999, true),
  repsMax: nullable(1, 999, true),
  weightKg: nullable(0, 1000),
  seconds: nullable(1, 86400, true),
  distanceMeters: nullable(1, 100000),
  restSeconds: { type: 'integer', minimum: 0, maximum: 1800 },
  rpe: nullable(1, 10),
});
const entry = object({ id: uuid, exerciseId: uuid, notes: text(1000), sets: list(series, 12, 1) });
const day = object({
  id: uuid,
  name: text(80, 1),
  weekday: { type: 'integer', minimum: 1, maximum: 7 },
  notes: text(1000),
  exercises: list(entry, 20),
});
const week = object({ id: uuid, name: text(80, 1), days: list(day, 7) });
const documentSchema = object({
  name: text(100, 2),
  description: text(1500),
  isTemplate: { type: 'boolean' },
  weeks: list(week, 16, 1),
});
const orgParams = object({ organizationId: uuid }),
  itemParams = object({ organizationId: uuid, id: uuid });
const revision = { type: 'integer', minimum: 1 };
interface ProgramRow {
  id: string;
  document: ProgramDocument;
  revision: number;
  archived: boolean;
  created_at: Date;
  updated_at: Date;
  published_count: string;
  latest_published_revision: number | null;
}
interface VersionRow {
  id: string;
  program_id: string;
  number: number;
  source_revision: number;
  snapshot: ProgramDocument;
  created_at: Date;
}
const programSelect =
  'SELECT p.*,(SELECT count(*) FROM program_versions v WHERE v.program_id=p.id) published_count,(SELECT max(source_revision) FROM program_versions v WHERE v.program_id=p.id) latest_published_revision FROM training_programs p';
const programDTO = (p: ProgramRow): TrainingProgram => ({
  id: p.id,
  document: p.document,
  revision: p.revision,
  archived: p.archived,
  createdAt: p.created_at.toISOString(),
  updatedAt: p.updated_at.toISOString(),
  publishedCount: Number(p.published_count),
  latestPublishedRevision: p.latest_published_revision,
});
const versionDTO = (v: VersionRow): ProgramVersion => ({
  id: v.id,
  programId: v.program_id,
  number: v.number,
  sourceRevision: v.source_revision,
  snapshot: v.snapshot,
  createdAt: v.created_at.toISOString(),
});
const assignmentSelect = `SELECT a.*,s.display_name student_name,v.snapshot->>'name' program_name,v.number version_number FROM program_assignments a JOIN students s ON s.organization_id=a.organization_id AND s.id=a.student_id JOIN program_versions v ON v.organization_id=a.organization_id AND v.id=a.version_id`;
type AssignmentRow = {
  id: string;
  version_id: string;
  student_id: string;
  student_name: string;
  program_name: string;
  version_number: number;
  starts_on: string;
  ends_on: string;
  state: ProgramAssignment['state'];
  revision: number;
  cancellation_reason: string | null;
};
const assignmentDTO = (a: AssignmentRow): ProgramAssignment => ({
  id: a.id,
  versionId: a.version_id,
  studentId: a.student_id,
  studentName: a.student_name,
  programName: a.program_name,
  versionNumber: a.version_number,
  startsOn: a.starts_on,
  endsOn: a.ends_on,
  state: a.state,
  revision: a.revision,
  cancellationReason: a.cancellation_reason,
});
// DATE columns are cast explicitly, never serialized through the server's timezone.
const assignmentColumns = assignmentSelect.replace(
  'a.*,',
  'a.id,a.version_id,a.student_id,a.starts_on::text,a.ends_on::text,a.state,a.revision,a.cancellation_reason,',
);
export async function registerPrograms(app: FastifyInstance, { pool, context }: Options) {
  const root = '/v1/organizations/:organizationId';
  const staff = ['owner', 'coach'];
  async function getProgram(db: PoolClient, id: string) {
    const row = (await db.query<ProgramRow>(programSelect + ' WHERE p.id=$1', [id])).rows[0];
    if (!row) throw problem(404, 'PROGRAM_NOT_FOUND', 'No se encontró el programa.');
    return programDTO(row);
  }
  function validate(doc: ProgramDocument, publish = false) {
    let errors: string[];
    try {
      errors = validateProgram(doc, publish);
    } catch {
      throw problem(
        400,
        'INVALID_PROGRAM',
        'Revisa la estructura y las prescripciones del programa.',
      );
    }
    if (errors.length) throw problem(400, 'INVALID_PROGRAM', errors.join(' '));
  }
  const validateRawDraft = async (request: FastifyRequest) =>
    validate((request.body as { document: ProgramDocument } | null)?.document as ProgramDocument);
  async function audit(db: PoolClient, org: string, user: string, action: string, id: string) {
    await db.query(
      'INSERT INTO audit_logs(organization_id,actor_user_id,action,metadata)VALUES($1,$2,$3,$4)',
      [org, user, action, JSON.stringify({ programId: id })],
    );
  }
  app.post<{ Params: { organizationId: string }; Body: { document: ProgramDocument } }>(
    root + '/programs/preview',
    {
      bodyLimit: 240000,
      preValidation: validateRawDraft,
      schema: { tags: ['programs'], params: orgParams, body: object({ document: documentSchema }) },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, staff);
      validate(request.body.document, true);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const snapshot = structuredClone(request.body.document);
        const ids = [
          ...new Set(
            snapshot.weeks.flatMap((w) =>
              w.days.flatMap((d) => d.exercises.map((x) => x.exerciseId)),
            ),
          ),
        ];
        const rows = (
          await db.query(
            'SELECT e.*,q.name equipment_name,q.description equipment_description,q.location equipment_location,q.state equipment_state,q.photo_id FROM exercises e LEFT JOIN equipment q ON q.organization_id=e.organization_id AND q.id=e.equipment_id WHERE e.id=ANY($1::uuid[])',
            [ids],
          )
        ).rows;
        const mediaIds = [
          ...new Set(rows.flatMap((e) => [e.media_id, e.photo_id]).filter(Boolean)),
        ];
        const media = (
          await db.query('SELECT * FROM media_assets WHERE id=ANY($1::uuid[])', [mediaIds])
        ).rows;
        for (const w of snapshot.weeks)
          for (const d of w.days)
            for (const x of d.exercises) {
              const e = rows.find((e) => e.id === x.exerciseId);
              if (!e || e.state === 'archived')
                throw problem(
                  400,
                  'INVALID_REFERENCE',
                  'Un ejercicio ya no está disponible. Sustitúyelo antes de publicar.',
                );
              for (const s of x.sets)
                if (
                  (e.metric === 'reps' && (s.repsMin === null || s.repsMax === null)) ||
                  (e.metric === 'time' && s.seconds === null) ||
                  (e.metric === 'distance' && s.distanceMeters === null)
                )
                  throw problem(
                    400,
                    'INVALID_PROGRAM',
                    'Completa las prescripciones según la métrica de cada ejercicio.',
                  );
              x.snapshot = {
                name: e.name,
                visualKey: e.visual_key,
                instructions: e.instructions,
                muscle: e.muscle,
                metric: e.metric,
                equipmentTag: e.equipment_tag,
                variations: e.variations,
                tags: e.tags,
                mediaId: e.media_id,
                photoId: e.photo_id ?? null,
                equipment: e.equipment_name
                  ? {
                      name: e.equipment_name,
                      description: e.equipment_description,
                      location: e.equipment_location,
                      state: e.equipment_state,
                    }
                  : null,
              };
              if (media.some((m) => [e.media_id, e.photo_id].includes(m.id) && m.state !== 'ready'))
                throw problem(409, 'MEDIA_NOT_READY', 'Espera a que los medios estén listos.');
              const m = media.find((m) => m.id === e.media_id),
                p = media.find((m) => m.id === e.photo_id);
              x.snapshot.media = m ? mediaDTO(m, org.id) : null;
              x.snapshot.photo = p ? mediaDTO(p, org.id) : null;
            }
        return { snapshot };
      });
    },
  );
  app.get<{
    Params: { organizationId: string };
    Querystring: {
      q?: string;
      template?: boolean;
      archived?: boolean;
      cursor?: string;
      limit?: number;
    };
  }>(
    root + '/programs',
    {
      schema: {
        tags: ['programs'],
        params: orgParams,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            q: text(100),
            template: { type: 'boolean' },
            archived: { type: 'boolean', default: false },
            cursor: uuid,
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, staff);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const q = request.query,
          limit = q.limit ?? 20;
        const rows = (
          await db.query<ProgramRow>(
            programSelect +
              ` WHERE p.archived=$1 AND ($2='' OR p.document->>'name' ILIKE '%'||$2||'%') AND ($3::boolean IS NULL OR (p.document->>'isTemplate')::boolean=$3) AND ($4::uuid IS NULL OR (p.created_at,p.id)<(SELECT created_at,id FROM training_programs WHERE id=$4)) ORDER BY p.created_at DESC,p.id DESC LIMIT $5`,
            [q.archived, q.q ?? '', q.template ?? null, q.cursor ?? null, limit + 1],
          )
        ).rows;
        return {
          programs: rows.slice(0, limit).map(programDTO),
          nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
        };
      });
    },
  );
  app.post<{ Params: { organizationId: string }; Body: { document: ProgramDocument } }>(
    root + '/programs',
    {
      bodyLimit: 240000,
      preValidation: validateRawDraft,
      schema: { tags: ['programs'], params: orgParams, body: object({ document: documentSchema }) },
    },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId, staff);
      validate(request.body.document);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const id = (
          await db.query<{ id: string }>(
            'INSERT INTO training_programs(organization_id,document,created_by)VALUES($1,$2,$3)RETURNING id',
            [org.id, JSON.stringify(request.body.document), user.id],
          )
        ).rows[0]!.id;
        await audit(db, org.id, user.id, 'program.created', id);
        reply.code(201);
        return { program: await getProgram(db, id) };
      });
    },
  );
  app.get<{ Params: { organizationId: string; id: string } }>(
    root + '/programs/:id',
    { schema: { tags: ['programs'], params: itemParams } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, staff);
      return actorTransaction(pool, user.id, org.id, async (db) => ({
        program: await getProgram(db, request.params.id),
      }));
    },
  );
  app.put<{
    Params: { organizationId: string; id: string };
    Body: { document: ProgramDocument; revision: number };
  }>(
    root + '/programs/:id',
    {
      bodyLimit: 240000,
      preValidation: validateRawDraft,
      schema: {
        tags: ['programs'],
        params: itemParams,
        body: object({ document: documentSchema, revision }),
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, staff);
      validate(request.body.document);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const p = await getProgram(db, request.params.id);
        if (p.archived)
          throw problem(409, 'STALE_PROGRAM', 'Restaura el programa antes de editarlo.');
        const result = await db.query(
          'UPDATE training_programs SET document=$1,revision=revision+1,updated_at=clock_timestamp() WHERE id=$2 AND revision=$3',
          [JSON.stringify(request.body.document), p.id, request.body.revision],
        );
        if (!result.rowCount)
          throw problem(409, 'STALE_PROGRAM', 'El borrador cambió. Vuelve a abrirlo.');
        await audit(db, org.id, user.id, 'program.saved', p.id);
        return { program: await getProgram(db, p.id) };
      });
    },
  );
  app.post<{
    Params: { organizationId: string; id: string };
    Body: { revision: number; archived: boolean };
  }>(
    root + '/programs/:id/archive',
    {
      schema: {
        tags: ['programs'],
        params: itemParams,
        body: object({ revision, archived: { type: 'boolean' } }),
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, staff);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        await getProgram(db, request.params.id);
        const result = await db.query(
          'UPDATE training_programs SET archived=$1,revision=revision+1,updated_at=clock_timestamp() WHERE id=$2 AND revision=$3',
          [request.body.archived, request.params.id, request.body.revision],
        );
        if (!result.rowCount)
          throw problem(409, 'STALE_PROGRAM', 'El programa cambió. Actualiza la lista.');
        await audit(db, org.id, user.id, 'program.archive_changed', request.params.id);
        return { program: await getProgram(db, request.params.id) };
      });
    },
  );
  app.post<{ Params: { organizationId: string; id: string }; Body: { revision: number } }>(
    root + '/programs/:id/delete',
    { schema: { tags: ['programs'], params: itemParams, body: object({ revision }) } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, ['owner']);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        await db.query('SELECT app.delete_program_draft($1,$2)', [
          request.params.id,
          request.body.revision,
        ]);
        return { ok: true };
      });
    },
  );
  app.post<{ Params: { organizationId: string; id: string }; Body: { versionId: string | null } }>(
    root + '/programs/:id/copy',
    {
      schema: {
        tags: ['programs'],
        params: itemParams,
        body: object({ versionId: { anyOf: [uuid, { type: 'null' }] } }),
      },
    },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId, staff);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const source = await getProgram(db, request.params.id);
        let doc = source.document;
        if (request.body.versionId) {
          const version = (
            await db.query<VersionRow>(
              'SELECT * FROM program_versions WHERE id=$1 AND program_id=$2',
              [request.body.versionId, source.id],
            )
          ).rows[0];
          if (!version) throw problem(404, 'VERSION_NOT_FOUND', 'No se encontró la versión.');
          doc = version.snapshot;
        }
        doc = structuredClone(doc);
        doc.name = (doc.name + ' · copia').slice(0, 100);
        for (const w of doc.weeks)
          for (const d of w.days) for (const x of d.exercises) delete x.snapshot;
        validate(doc);
        const id = (
          await db.query<{ id: string }>(
            'INSERT INTO training_programs(organization_id,document,created_by)VALUES($1,$2,$3)RETURNING id',
            [org.id, JSON.stringify(doc), user.id],
          )
        ).rows[0]!.id;
        await audit(db, org.id, user.id, 'program.copied', id);
        reply.code(201);
        return { program: await getProgram(db, id) };
      });
    },
  );
  app.post<{ Params: { organizationId: string; id: string }; Body: { revision: number } }>(
    root + '/programs/:id/publish',
    { schema: { tags: ['programs'], params: itemParams, body: object({ revision }) } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, staff);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const p = await getProgram(db, request.params.id);
        validate(p.document, true);
        const id = (
          await db.query<{ id: string }>('SELECT app.publish_program($1,$2) id', [
            p.id,
            request.body.revision,
          ])
        ).rows[0]!.id;
        const v = (await db.query<VersionRow>('SELECT * FROM program_versions WHERE id=$1', [id]))
          .rows[0]!;
        return { version: versionDTO(v) };
      });
    },
  );
  app.get<{
    Params: { organizationId: string; id: string };
    Querystring: { beforeNumber?: number; limit?: number };
  }>(
    root + '/programs/:id/versions',
    {
      schema: {
        tags: ['programs'],
        params: itemParams,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            beforeNumber: { type: 'integer', minimum: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, staff);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        await getProgram(db, request.params.id);
        const limit = request.query.limit ?? 30;
        const rows = (
          await db.query<VersionRow>(
            'SELECT id,program_id,number,source_revision,created_at FROM program_versions WHERE program_id=$1 AND ($2::integer IS NULL OR number<$2) ORDER BY number DESC LIMIT $3',
            [request.params.id, request.query.beforeNumber ?? null, limit + 1],
          )
        ).rows;
        return {
          nextNumber: rows.length > limit ? rows[limit - 1]!.number : null,
          versions: rows.slice(0, limit).map((v) => {
            return {
              id: v.id,
              programId: v.program_id,
              number: v.number,
              sourceRevision: v.source_revision,
              createdAt: v.created_at.toISOString(),
            };
          }),
        };
      });
    },
  );
  app.get<{ Params: { organizationId: string; id: string } }>(
    root + '/program-versions/:id',
    { schema: { tags: ['programs'], params: itemParams } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const row = (
          await db.query<VersionRow>('SELECT * FROM program_versions WHERE id=$1', [
            request.params.id,
          ])
        ).rows[0];
        if (!row) throw problem(404, 'VERSION_NOT_FOUND', 'No se encontró la versión.');
        const refs = new Set<string>();
        for (const w of row.snapshot.weeks)
          for (const d of w.days)
            for (const x of d.exercises) {
              if (x.snapshot?.mediaId) refs.add(x.snapshot.mediaId);
              if (x.snapshot?.photoId) refs.add(x.snapshot.photoId);
            }
        const media = (
          await db.query('SELECT * FROM media_assets WHERE id=ANY($1::uuid[])', [[...refs]])
        ).rows;
        for (const w of row.snapshot.weeks)
          for (const d of w.days)
            for (const x of d.exercises)
              if (x.snapshot) {
                const m = media.find((m) => m.id === x.snapshot!.mediaId),
                  p = media.find((m) => m.id === x.snapshot!.photoId);
                x.snapshot.media = m ? mediaDTO(m, org.id) : null;
                x.snapshot.photo = p ? mediaDTO(p, org.id) : null;
              }
        return { version: versionDTO(row) };
      });
    },
  );
  app.post<{
    Params: { organizationId: string; id: string };
    Body: { startsOn: string; studentIds: string[]; requestId: string };
  }>(
    root + '/program-versions/:id/assignments',
    {
      schema: {
        tags: ['programs'],
        params: itemParams,
        body: object({
          startsOn: { type: 'string', format: 'date' },
          studentIds: { ...list(uuid, 100, 1), uniqueItems: true },
          requestId: uuid,
        }),
      },
    },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId, staff);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const id = (
          await db.query<{ id: string }>(
            'SELECT app.assign_program($1,$2::date,$3::uuid[],$4::uuid) id',
            [
              request.params.id,
              request.body.startsOn,
              request.body.studentIds,
              request.body.requestId,
            ],
          )
        ).rows[0]!.id;
        const rows = (
          await db.query<AssignmentRow>(
            assignmentColumns + ' WHERE a.batch_id=$1 ORDER BY a.student_id',
            [id],
          )
        ).rows;
        reply.code(201);
        return { assignments: rows.map(assignmentDTO) };
      });
    },
  );
  app.get<{
    Params: { organizationId: string };
    Querystring: {
      studentId?: string;
      state?: string;
      from?: string;
      to?: string;
      cursor?: string;
      limit?: number;
    };
  }>(
    root + '/program-assignments',
    {
      schema: {
        tags: ['programs'],
        params: orgParams,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            studentId: uuid,
            state: { type: 'string', enum: ['all', 'active', 'cancelled'], default: 'all' },
            from: { type: 'string', format: 'date' },
            to: { type: 'string', format: 'date' },
            cursor: uuid,
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const q = request.query,
          limit = q.limit ?? 30;
        const rows = (
          await db.query<AssignmentRow>(
            assignmentColumns +
              ` WHERE ($1::uuid IS NULL OR a.student_id=$1) AND ($2='all' OR a.state=$2) AND ($3::date IS NULL OR a.ends_on>=$3) AND ($4::date IS NULL OR a.starts_on<=$4) AND ($5::uuid IS NULL OR (a.starts_on,a.id)<(SELECT starts_on,id FROM program_assignments WHERE id=$5)) ORDER BY a.starts_on DESC,a.id DESC LIMIT $6`,
            [
              q.studentId ?? null,
              q.state ?? 'all',
              q.from ?? null,
              q.to ?? null,
              q.cursor ?? null,
              limit + 1,
            ],
          )
        ).rows;
        return {
          assignments: rows.slice(0, limit).map(assignmentDTO),
          nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
        };
      });
    },
  );
  app.post<{
    Params: { organizationId: string; id: string };
    Body: { revision: number; reason: string };
  }>(
    root + '/program-assignments/:id/cancel',
    {
      schema: {
        tags: ['programs'],
        params: itemParams,
        body: object({ revision, reason: text(200, 3) }),
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, staff);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        await db.query('SELECT app.cancel_program_assignment($1,$2,$3)', [
          request.params.id,
          request.body.revision,
          request.body.reason,
        ]);
        return { success: true };
      });
    },
  );
}
