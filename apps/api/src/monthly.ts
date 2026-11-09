import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import type { CurrentUser, OrganizationSummary, MonthlyCoach, MonthlyStudent } from '@forma/shared';
import { actorTransaction, tenantSlug } from './organizations.js';
import { problem } from './problems.js';
import type { AppConfig } from './app.js';
const uuid = { type: 'string', format: 'uuid' },
  month = { type: 'string', pattern: '^20[0-9]{2}-(0[1-9]|1[0-2])$' },
  revision = { type: 'integer', minimum: 0 },
  reason = { type: 'string', minLength: 3, maxLength: 500 },
  object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
    type: 'object',
    additionalProperties: false,
    properties,
    required,
  }),
  params = object({ organizationId: uuid }),
  item = object({ organizationId: uuid, studentId: uuid }),
  query = object({ month }, ['month']),
  markBody = object({ month, paid: { type: 'boolean' }, revision, requestId: uuid, reason });
interface P {
  organizationId: string;
  studentId: string;
}
interface Mark {
  month: string;
  paid: boolean;
  revision: number;
  requestId: string;
  reason: string;
}
export function registerMonthly(
  app: FastifyInstance,
  options: {
    pool: Pool;
    config: AppConfig;
    requireUser: (req: FastifyRequest) => Promise<CurrentUser>;
    context: (
      req: FastifyRequest,
      id: string,
      roles?: string[],
    ) => Promise<{ user: CurrentUser; org: OrganizationSummary }>;
  },
) {
  const { pool, requireUser, context, config } = options;
  app.get<{ Querystring: { month: string } }>(
    '/v1/admin/monthly-coaches',
    { schema: { querystring: query } },
    async (req) => {
      const user = await requireUser(req);
      return actorTransaction(pool, user.id, null, async (db) => {
        if (!(await db.query('SELECT app.is_platform_admin() allowed')).rows[0].allowed)
          throw problem(403, 'FORBIDDEN', 'Solo administración.');
        // Same scope as the existing admin list; no pupil names or financial contents.
        const ids = (await db.query('SELECT app.admin_organizations() data')).rows[0].data as {
          id: string;
        }[];
        const result = await db.query(
          'SELECT app.monthly_info(id,$2::date) data FROM unnest($1::uuid[]) id',
          [ids.map((o) => o.id), req.query.month + '-01'],
        );
        return { coaches: result.rows.map((r) => r.data as MonthlyCoach) };
      });
    },
  );
  app.put<{
    Params: P;
    Body: {
      studentLimit: number;
      monthlyPricePyg: number | null;
      accessEnabled: boolean;
      revision: number;
      requestId: string;
      reason: string;
    };
  }>(
    '/v1/admin/organizations/:organizationId/manual-control',
    {
      schema: {
        params,
        body: object({
          studentLimit: { type: 'integer', minimum: 0, maximum: 5000 },
          monthlyPricePyg: { type: ['integer', 'null'], minimum: 0, maximum: 1000000000000 },
          accessEnabled: { type: 'boolean' },
          revision,
          requestId: uuid,
          reason: { ...reason, minLength: 10 },
        }),
      },
    },
    async (req) => {
      const user = await requireUser(req),
        b = req.body;
      return actorTransaction(pool, user.id, null, async (db) => ({
        control: (
          await db.query('SELECT app.manual_configure($1,$2,$3,$4,$5,$6,$7) data', [
            req.params.organizationId,
            b.studentLimit,
            b.monthlyPricePyg,
            b.accessEnabled,
            b.revision,
            b.requestId,
            b.reason.trim(),
          ])
        ).rows[0].data,
      }));
    },
  );
  app.get<{ Params: P; Querystring: { month: string } }>(
    '/v1/organizations/:organizationId/monthly-control',
    { schema: { params, querystring: query } },
    async (req) => {
      const user = await requireUser(req),
        org = req.params.organizationId;
      const slug = tenantSlug(req.hostname, config.tenantBaseDomain);
      if (
        slug &&
        (await pool.query('SELECT app.public_brand($1) data', [slug])).rows[0]?.data?.id !== org
      )
        throw problem(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró el estudio.');
      return actorTransaction(pool, user.id, org, async (db) => ({
        control: (
          await db.query('SELECT app.monthly_info($1,$2::date) data', [
            org,
            req.query.month + '-01',
          ])
        ).rows[0].data,
      }));
    },
  );
  app.get<{ Params: P; Querystring: { month: string; q?: string; cursor?: string } }>(
    '/v1/organizations/:organizationId/monthly-students',
    {
      schema: {
        params,
        querystring: object({ month, q: { type: 'string', maxLength: 100 }, cursor: uuid }, [
          'month',
        ]),
      },
    },
    async (req) => {
      const { user, org } = await context(req, req.params.organizationId, ['owner']);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const rows = (
          await db.query('SELECT app.manual_students($1::date,$2,$3) data', [
            req.query.month + '-01',
            req.query.q ?? '',
            req.query.cursor ?? null,
          ])
        ).rows[0].data as MonthlyStudent[];
        return { students: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49]!.id : null };
      });
    },
  );
  for (const platform of [true, false])
    app.put<{ Params: P; Body: Mark }>(
      platform
        ? '/v1/admin/organizations/:organizationId/monthly-payment'
        : '/v1/organizations/:organizationId/students/:studentId/monthly-payment',
      { schema: { params: platform ? params : item, body: markBody } },
      async (req) => {
        const user = platform
            ? await requireUser(req)
            : (await context(req, req.params.organizationId, ['owner'])).user,
          b = req.body;
        return actorTransaction(
          pool,
          user.id,
          platform ? null : req.params.organizationId,
          async (db) => ({
            payment: (
              await db.query('SELECT app.monthly_mark($1,$2,$3::date,$4,$5,$6,$7) data', [
                req.params.organizationId,
                platform ? null : req.params.studentId,
                b.month + '-01',
                b.paid,
                b.revision,
                b.requestId,
                b.reason.trim(),
              ])
            ).rows[0].data,
          }),
        );
      },
    );
}
