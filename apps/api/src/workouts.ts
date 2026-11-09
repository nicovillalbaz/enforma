import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  validWorkoutEvent,
  type CurrentUser,
  type OrganizationSummary,
  type WorkoutSession,
  type WorkoutSet,
  type WorkoutEvent,
  type WorkoutReceipt,
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
const uuid = { type: 'string', format: 'uuid' },
  params = {
    type: 'object',
    required: ['organizationId', 'id'],
    properties: { organizationId: uuid, id: uuid },
  },
  root = '/v1/organizations/:organizationId/workouts';
function sessionDTO(
  r: QueryResultRow,
  rows: QueryResultRow[],
  media: Parameters<typeof mediaDTO>[0][],
): WorkoutSession {
  const sets: WorkoutSet[] = rows.map((x) => ({
    entryId: x.entry_id,
    setId: x.set_id,
    position: x.position,
    metric: x.metric,
    target: x.target,
    state: x.state,
    revision: x.revision,
    actual: {
      weightKg: x.weight_kg === null ? null : Number(x.weight_kg),
      reps: x.reps,
      seconds: x.seconds,
      distanceMeters: x.distance_meters === null ? null : Number(x.distance_meters),
      rpe: x.rpe === null ? null : Number(x.rpe),
      note: x.note,
    },
    recordedAt: x.recorded_at?.toISOString() ?? null,
  }));
  const prescription = structuredClone(r.prescription) as WorkoutSession['prescription'];
  for (const x of prescription.exercises)
    if (x.snapshot) {
      x.snapshot.media = media.find((m) => m.id === x.snapshot!.mediaId)
        ? mediaDTO(
            media.find((m) => m.id === x.snapshot!.mediaId)!,
            r.organization_id,
          )
        : null;
      x.snapshot.photo = media.find((m) => m.id === x.snapshot!.photoId)
        ? mediaDTO(
            media.find((m) => m.id === x.snapshot!.photoId)!,
            r.organization_id,
          )
        : null;
    }
  return {
    id: r.id,
    organizationId: r.organization_id,
    studentId: r.student_id,
    studentName: r.student_name,
    userId: r.user_id,
    assignmentId: r.assignment_id,
    versionId: r.version_id,
    weekId: r.week_id,
    dayId: r.day_id,
    scheduledOn: r.day_date,
    programName: r.program_name,
    versionNumber: r.version_number,
    weekName: r.week_name,
    prescription,
    state: r.state,
    revision: r.revision,
    notes: r.notes,
    notesRevision: r.notes_revision,
    startedClientAt: r.started_client_at?.toISOString() ?? null,
    completedAt: r.completed_at?.toISOString() ?? null,
    durationSeconds: r.duration_seconds,
    accessActive: r.assignment_state === 'active',
    sets,
  };
}
async function readMany(db: PoolClient, ids: string[]): Promise<WorkoutSession[]> {
  if (!ids.length) return [];
  await db.query('SELECT app.lock_workout(id) FROM unnest($1::uuid[]) id ORDER BY id', [ids]);
  const rows = (
    await db.query(
      'SELECT s.*,s.scheduled_on::text day_date,p.display_name student_name,a.state assignment_state FROM workout_sessions s JOIN students p ON p.organization_id=s.organization_id AND p.id=s.student_id LEFT JOIN program_assignments a ON a.organization_id=s.organization_id AND a.id=s.assignment_id WHERE s.id=ANY($1::uuid[])',
      [ids],
    )
  ).rows;
  const sets = (
    await db.query(
      'SELECT * FROM workout_sets WHERE session_id=ANY($1::uuid[]) ORDER BY session_id,position',
      [ids],
    )
  ).rows;
  const media = (
    await db.query<Parameters<typeof mediaDTO>[0] & { session_id: string }>(
      'SELECT m.*,r.session_id FROM media_assets m JOIN workout_session_media r ON r.organization_id=m.organization_id AND r.media_id=m.id WHERE r.session_id=ANY($1::uuid[])',
      [ids],
    )
  ).rows;
  const bySession = new Map<string, QueryResultRow[]>(),
    byMedia = new Map<string, (Parameters<typeof mediaDTO>[0] & { session_id: string })[]>();
  for (const r of sets) {
    if (!bySession.has(r.session_id)) bySession.set(r.session_id, []);
    bySession.get(r.session_id)!.push(r);
  }
  for (const r of media) {
    if (!byMedia.has(r.session_id)) byMedia.set(r.session_id, []);
    byMedia.get(r.session_id)!.push(r);
  }
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => {
    const r = byId.get(id);
    if (!r) throw problem(404, 'WORKOUT_NOT_FOUND', 'No se encontró la sesión.');
    return sessionDTO(r, bySession.get(id) ?? [], byMedia.get(id) ?? []);
  });
}
async function read(db: PoolClient, id: string): Promise<WorkoutSession> {
  return (await readMany(db, [id]))[0]!;
}
export async function registerWorkouts(app: FastifyInstance, { pool, context }: Options) {
  app.post<{
    Params: { organizationId: string };
    Body: { assignmentId: string; weekId: string; dayId: string };
  }>(
    root + '/prepare',
    {
      schema: {
        tags: ['workouts'],
        params: {
          type: 'object',
          required: ['organizationId'],
          properties: { organizationId: uuid },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['assignmentId', 'weekId', 'dayId'],
          properties: { assignmentId: uuid, weekId: uuid, dayId: uuid },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, ['student']);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const id = (
          await db.query('SELECT app.prepare_workout($1,$2,$3) id', [
            request.body.assignmentId,
            request.body.weekId,
            request.body.dayId,
          ])
        ).rows[0].id;
        return { session: await read(db, id) };
      });
    },
  );
  app.get<{ Params: { organizationId: string; id: string } }>(
    root + '/:id',
    { schema: { tags: ['workouts'], params } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      return actorTransaction(pool, user.id, org.id, async (db) => ({
        session: await read(db, request.params.id),
      }));
    },
  );
  app.get<{
    Params: { organizationId: string };
    Querystring: {
      studentId?: string;
      before?: string;
      limit?: number;
      from?: string;
      to?: string;
      state?: string;
    };
  }>(
    root,
    {
      schema: {
        tags: ['workouts'],
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            studentId: uuid,
            from: { type: 'string', format: 'date' },
            to: { type: 'string', format: 'date' },
            state: { type: 'string', enum: ['planned', 'in_progress', 'completed'] },
            before: uuid,
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      const q = request.query;
      for (const d of [q.from, q.to])
        if (
          d &&
          (!/^\d{4}-\d{2}-\d{2}$/.test(d) ||
            d < '2000-01-01' ||
            d > '2100-01-01' ||
            !Number.isFinite(Date.parse(d + 'T12:00:00Z')) ||
            new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) !== d)
        )
          throw problem(400, 'INVALID_WORKOUT', 'Revisa las fechas del historial.');
      if (q.from && q.to && q.from > q.to)
        throw problem(400, 'INVALID_WORKOUT', 'Revisa el orden de las fechas.');
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const rows = (
          await db.query(
            'SELECT id,created_at FROM workout_sessions WHERE ($1::uuid IS NULL OR student_id=$1) AND ($2::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM workout_sessions WHERE id=$2)) AND ($4::date IS NULL OR scheduled_on>=$4) AND ($5::date IS NULL OR scheduled_on<=$5) AND ($6::text IS NULL OR state=$6) ORDER BY created_at DESC,id DESC LIMIT $3',
            [
              request.query.studentId ?? null,
              request.query.before ?? null,
              (request.query.limit ?? 20) + 1,
              request.query.from ?? null,
              request.query.to ?? null,
              request.query.state ?? null,
            ],
          )
        ).rows;
        return {
          sessions: await readMany(
            db,
            rows.slice(0, request.query.limit ?? 20).map((r) => r.id),
          ),
          nextBefore:
            rows.length > (request.query.limit ?? 20)
              ? rows[(request.query.limit ?? 20) - 1].id
              : null,
        };
      });
    },
  );
  app.post<{ Params: { organizationId: string; id: string }; Body: WorkoutEvent }>(
    root + '/:id/events',
    {
      bodyLimit: 8000,
      preValidation: async (request) => {
        if (!validWorkoutEvent(request.body))
          throw problem(400, 'INVALID_WORKOUT', 'Revisa los valores y unidades del registro.');
      },
      schema: { tags: ['workouts'], params },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, ['student']);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const e = request.body;
        const receipt = (
          await db.query('SELECT app.apply_workout_event($1,$2,$3) receipt', [
            request.params.id,
            e.clientEventId,
            JSON.stringify({ deviceId: e.deviceId, command: e.command }),
          ])
        ).rows[0].receipt as WorkoutReceipt;
        return { receipt, session: await read(db, request.params.id) };
      });
    },
  );
}
