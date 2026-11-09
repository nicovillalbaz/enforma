import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import type { FollowupOptions } from './followup.js';
import { actorTransaction } from './organizations.js';
import { problem } from './problems.js';
import { dateShift } from '@forma/shared';
const uuid = { type: 'string', format: 'uuid' },
  date = { type: 'string', format: 'date' },
  boolean = { type: 'boolean' },
  revision = { type: 'integer', minimum: 0 },
  text = (max: number, min = 0) => ({ type: 'string', maxLength: max, minLength: min }),
  integer = (max: number, min = 0) => ({ type: 'integer', minimum: min, maximum: max }),
  object = (properties: Record<string, unknown>) => ({
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  }),
  params = object({ organizationId: uuid }),
  item = object({ organizationId: uuid, id: uuid }),
  instant = {
    type: 'string',
    format: 'date-time',
    maxLength: 35,
    pattern: '(Z|[+-][0-9]{2}:[0-9]{2})$',
  },
  local = { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$' },
  timing = { timezone: text(100, 1), localStartsAt: local, localEndsAt: local },
  eventDoc = object({
    professionalId: uuid,
    availabilityId: uuid,
    kind: { enum: ['appointment', 'class'] },
    title: text(100, 2),
    instructions: text(1500),
    location: text(200),
    startsAt: instant,
    endsAt: instant,
    capacity: integer(100, 1),
    bookingLeadMinutes: integer(10080),
    cancelLeadMinutes: integer(10080),
    published: boolean,
  }),
  command = { revision, requestId: uuid };
type P = { organizationId: string; id: string };
type Timing = { timezone: string; localStartsAt: string; localEndsAt: string };
type EventDocument = {
  professionalId: string;
  availabilityId: string;
  kind: string;
  title: string;
  instructions: string;
  location: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  bookingLeadMinutes: number;
  cancelLeadMinutes: number;
  published: boolean;
};
function decode(value?: string): [string | null, string | null] {
  if (!value) return [null, null];
  try {
    const v = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (
      Array.isArray(v) &&
      v.length === 2 &&
      typeof v[0] === 'string' &&
      Number.isFinite(Date.parse(v[0])) &&
      /^[a-f0-9-]{36}$/i.test(v[1])
    )
      return [v[0], v[1]];
  } catch {
    /* Invalid cursor is rejected below. */
  }
  throw problem(400, 'INVALID_CURSOR', 'Actualiza la agenda.');
}
export async function registerAgenda(app: FastifyInstance, { pool, context }: FollowupOptions) {
  const root = '/v1/organizations/:organizationId/agenda';
  async function run<T>(
    req: FastifyRequest,
    id: string,
    fn: (db: PoolClient) => Promise<T>,
    roles?: string[],
  ) {
    const { user, org } = await context(req, id, roles);
    return actorTransaction(pool, user.id, org.id, fn);
  }
  async function wallTime(db: PoolClient, body: Timing, start: string, end: string) {
    const row = (
      await db.query(
        `SELECT timezone,to_char($1::timestamptz AT TIME ZONE timezone,'YYYY-MM-DD"T"HH24:MI') local_start,to_char($2::timestamptz AT TIME ZONE timezone,'YYYY-MM-DD"T"HH24:MI') local_end FROM organizations WHERE id=app.tenant()`,
        [start, end],
      )
    ).rows[0];
    if (
      !row ||
      row.timezone !== body.timezone ||
      row.local_start !== body.localStartsAt ||
      row.local_end !== body.localEndsAt
    )
      throw problem(
        409,
        'AGENDA_TIMEZONE',
        'La conversión horaria no coincide con la zona del estudio. Actualiza la agenda y revisa el horario.',
      );
  }
  app.get<{
    Params: P;
    Querystring: {
      from?: string;
      to?: string;
      professionalId?: string;
      cursor?: string;
      mine?: string;
    };
  }>(
    root,
    {
      schema: {
        params,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            from: date,
            to: date,
            professionalId: uuid,
            cursor: { type: 'string', maxLength: 120, pattern: '^[A-Za-z0-9_-]+$' },
            mine: { enum: ['1'], type: 'string' },
          },
        },
      },
    },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        const meta = (
            await db.query(
              'SELECT timezone,(now() AT TIME ZONE timezone)::date::text today FROM organizations WHERE id=app.tenant()',
            )
          ).rows[0],
          from = req.query.from ?? meta.today,
          to = req.query.to ?? dateShift(from, 6);
        if (
          (Date.parse(to) - Date.parse(from)) / 86400000 < 0 ||
          (Date.parse(to) - Date.parse(from)) / 86400000 > 30
        )
          throw problem(400, 'INVALID_AGENDA', 'Elige un periodo de hasta 31 días.');
        const c = decode(req.query.cursor),
          values = [
            from,
            to,
            meta.timezone,
            req.query.professionalId ?? null,
            c[0],
            c[1],
            req.query.mine === '1',
          ];
        const rows = (
          await db.query(
            `SELECT e.id,e.starts_at,app.agenda_event_info(e.id) data FROM agenda_events e WHERE e.ends_at>($1::date::timestamp AT TIME ZONE $3) AND e.starts_at<(($2::date+1)::timestamp AT TIME ZONE $3) AND($4::uuid IS NULL OR e.professional_id=$4) AND($5::timestamptz IS NULL OR(e.starts_at,e.id)>($5,$6::uuid)) AND(NOT $7::boolean OR EXISTS(SELECT 1 FROM agenda_bookings b WHERE b.event_id=e.id AND b.user_id=app.actor())) ORDER BY e.starts_at,e.id LIMIT 101`,
            values,
          )
        ).rows;
        const availability = (
          await db.query(
            `SELECT a.id,a.professional_id "professionalId",u.full_name "professionalName",a.starts_at "startsAt",a.ends_at "endsAt",a.location,a.revision,a.cancelled_at IS NOT NULL cancelled FROM agenda_availability a JOIN app_users u ON u.id=a.professional_id WHERE a.ends_at>($1::date::timestamp AT TIME ZONE $3) AND a.starts_at<(($2::date+1)::timestamp AT TIME ZONE $3) AND($4::uuid IS NULL OR a.professional_id=$4) ORDER BY a.starts_at,a.id LIMIT 101`,
            values.slice(0, 4),
          )
        ).rows;
        return {
          ...meta,
          studentId: (await db.query('SELECT app.agenda_self() id')).rows[0].id,
          events: rows.slice(0, 100).map((r) => r.data),
          nextCursor:
            rows.length > 100
              ? Buffer.from(JSON.stringify([rows[99].starts_at, rows[99].id])).toString('base64url')
              : null,
          availability: availability.slice(0, 100),
          availabilityTruncated: availability.length > 100,
          professionals: (await db.query('SELECT app.agenda_professionals() data')).rows[0].data,
          preferences: (
            await db.query(
              'SELECT revision,booking,change,reminder,welcome,checkin,quiet_start "quietStart",quiet_end "quietEnd",daily_limit "dailyLimit" FROM agenda_preferences',
            )
          ).rows[0] ?? {
            revision: 0,
            booking: true,
            change: true,
            reminder: true,
            welcome: true,
            checkin: true,
            quietStart: 1320,
            quietEnd: 420,
            dailyLimit: 10,
          },
          notifications: (
            await db.query(
              'SELECT id,category,event_id "eventId",thread_id "threadId",delivered_at "createdAt",read_at IS NOT NULL read FROM agenda_notifications ORDER BY delivered_at DESC,id DESC LIMIT 30',
            )
          ).rows,
          workerOnline: !!(
            await db.query(
              "SELECT 1 FROM agenda_worker_state WHERE heartbeat_at>now()-interval '3 minutes'",
            )
          ).rowCount,
        };
      }),
  );
  app.put<{
    Params: P;
    Body: Timing & {
      requestId: string;
      revision: number;
      professionalId: string;
      startsAt: string;
      endsAt: string;
      location: string;
    };
  }>(
    root + '/availability/:id',
    {
      schema: {
        params: item,
        body: object({
          ...command,
          ...timing,
          professionalId: uuid,
          startsAt: instant,
          endsAt: instant,
          location: text(200),
        }),
      },
    },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) => {
          const b = req.body;
          await wallTime(db, b, b.startsAt, b.endsAt);
          return (
            await db.query('SELECT app.save_agenda_availability($1,$2,$3,$4,$5,$6,$7) data', [
              req.params.id,
              b.revision,
              b.requestId,
              b.professionalId,
              b.startsAt,
              b.endsAt,
              b.location,
            ])
          ).rows[0].data;
        },
        ['owner', 'coach'],
      ),
  );
  app.post<{ Params: P; Body: { revision: number; requestId: string } }>(
    root + '/availability/:id/cancel',
    { schema: { params: item, body: object(command) } },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.cancel_agenda_availability($1,$2,$3) data', [
              req.params.id,
              req.body.revision,
              req.body.requestId,
            ])
          ).rows[0].data,
        ['owner', 'coach'],
      ),
  );
  app.put<{
    Params: P;
    Body: Timing & { requestId: string; revision: number; document: EventDocument; reason: string };
  }>(
    root + '/events/:id',
    {
      schema: {
        params: item,
        body: object({ ...command, ...timing, document: eventDoc, reason: text(300) }),
      },
    },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) => {
          const b = req.body;
          await wallTime(db, b, b.document.startsAt, b.document.endsAt);
          return (
            await db.query('SELECT app.save_agenda_event($1,$2,$3,$4,$5) data', [
              req.params.id,
              b.revision,
              b.requestId,
              b.document,
              b.reason,
            ])
          ).rows[0].data;
        },
        ['owner', 'coach'],
      ),
  );
  app.get<{ Params: P; Querystring: { q?: string } }>(
    root + '/events/:id',
    {
      schema: {
        params: item,
        querystring: { type: 'object', additionalProperties: false, properties: { q: text(100) } },
      },
    },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        const e = (await db.query('SELECT app.agenda_event_info($1) data', [req.params.id])).rows[0]
          .data;
        return {
          event: e,
          bookings: e.canManage
            ? (await db.query('SELECT app.agenda_roster($1) data', [req.params.id])).rows[0].data
            : [],
          people: e.canManage
            ? (
                await db.query('SELECT app.agenda_people($1,$2) data', [
                  req.params.id,
                  req.query.q ?? '',
                ])
              ).rows[0].data
            : [],
        };
      }),
  );
  app.post<{ Params: P; Body: { revision: number; requestId: string; reason: string } }>(
    root + '/events/:id/cancel',
    { schema: { params: item, body: object({ ...command, reason: text(300, 10) }) } },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.cancel_agenda_event($1,$2,$3,$4) data', [
              req.params.id,
              req.body.revision,
              req.body.requestId,
              req.body.reason,
            ])
          ).rows[0].data,
        ['owner', 'coach'],
      ),
  );
  app.post<{ Params: P; Body: { studentId: string; requestId: string } }>(
    root + '/events/:id/book',
    { schema: { params: item, body: object({ studentId: uuid, requestId: uuid }) } },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.book_agenda_event($1,$2,$3) data', [
              req.params.id,
              req.body.studentId,
              req.body.requestId,
            ])
          ).rows[0].data,
      ),
  );
  app.post<{ Params: P; Body: { revision: number; requestId: string; reason: string } }>(
    root + '/bookings/:id/cancel',
    { schema: { params: item, body: object({ ...command, reason: text(300) }) } },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.cancel_agenda_booking($1,$2,$3,$4) data', [
              req.params.id,
              req.body.revision,
              req.body.requestId,
              req.body.reason,
            ])
          ).rows[0].data,
      ),
  );
  app.post<{ Params: P; Body: { revision: number; requestId: string; state: string } }>(
    root + '/bookings/:id/attendance',
    {
      schema: {
        params: item,
        body: object({ ...command, state: { enum: ['pending', 'attended', 'absent'] } }),
      },
    },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.attend_agenda_booking($1,$2,$3,$4) data', [
              req.params.id,
              req.body.revision,
              req.body.requestId,
              req.body.state,
            ])
          ).rows[0].data,
        ['owner', 'coach'],
      ),
  );
  app.put<{ Params: P; Body: { revision: number; requestId: string; document: unknown } }>(
    root + '/preferences',
    {
      schema: {
        params,
        body: object({
          ...command,
          document: object({
            booking: boolean,
            change: boolean,
            reminder: boolean,
            welcome: boolean,
            checkin: boolean,
            quietStart: integer(1439),
            quietEnd: integer(1439),
            dailyLimit: integer(20, 1),
          }),
        }),
      },
    },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.save_agenda_preferences($1,$2,$3) data', [
              req.body.revision,
              req.body.requestId,
              req.body.document,
            ])
          ).rows[0].data,
      ),
  );
  app.post<{ Params: P; Body: { ids: string[] } }>(
    root + '/notifications/read',
    { schema: { params, body: object({ ids: { type: 'array', items: uuid, maxItems: 50 } }) } },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        await db.query('SELECT app.read_agenda_notifications($1)', [req.body.ids]);
        return { ok: true };
      }),
  );
  app.get<{ Params: P }>(root + '/rules', { schema: { params } }, async (req) =>
    run(
      req,
      req.params.organizationId,
      async (db) => ({
        rules: (
          await db.query(
            'SELECT r.id,r.kind,r.enabled,r.revision,v.number version,(v.document->>\'leadMinutes\')::integer "leadMinutes" FROM agenda_rules r JOIN agenda_rule_versions v ON v.id=r.current_version_id ORDER BY r.kind',
          )
        ).rows,
        runs: (
          await db.query(
            'SELECT run.id,o.kind,run.status,run.reason,run.revision,run.retries,run.created_at "createdAt",o.expires_at "expiresAt",CASE WHEN o.kind=\'checkin.pending\' AND NOT EXISTS(SELECT 1 FROM followup_checkin_tasks t JOIN followup_checkin_schedules s ON s.id=t.schedule_id JOIN followup_threads f ON f.id=s.thread_id WHERE t.id=o.task_id AND f.professional_id=app.actor()) THEN \'Alumno (seguimiento privado)\' ELSE u.full_name END recipient FROM agenda_runs run JOIN agenda_outbox o ON o.id=run.outbox_id JOIN app_users u ON u.id=o.recipient_id ORDER BY run.created_at DESC,run.id DESC LIMIT 50',
          )
        ).rows,
      }),
      ['owner'],
    ),
  );
  app.post<{
    Params: P;
    Body: { revision: number; requestId: string; enabled: boolean; leadMinutes: number };
  }>(
    root + '/rules/:id',
    {
      schema: {
        params: item,
        body: object({ ...command, enabled: boolean, leadMinutes: integer(10080) }),
      },
    },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.save_agenda_rule($1,$2,$3,$4,$5) data', [
              req.params.id,
              req.body.revision,
              req.body.requestId,
              req.body.enabled,
              req.body.leadMinutes,
            ])
          ).rows[0].data,
        ['owner'],
      ),
  );
  app.get<{ Params: P }>(root + '/rules/:id/preview', { schema: { params: item } }, async (req) =>
    run(
      req,
      req.params.organizationId,
      async (db) =>
        (await db.query('SELECT app.agenda_rule_preview($1) data', [req.params.id])).rows[0].data,
      ['owner'],
    ),
  );
  app.post<{ Params: P; Body: { revision: number; requestId: string } }>(
    root + '/runs/:id/retry',
    { schema: { params: item, body: object(command) } },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.retry_agenda_run($1,$2,$3) data', [
              req.params.id,
              req.body.revision,
              req.body.requestId,
            ])
          ).rows[0].data,
        ['owner'],
      ),
  );
}
