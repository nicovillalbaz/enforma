import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import type { CurrentUser, OrganizationSummary } from '@forma/shared';
import { actorTransaction } from './organizations.js';
import { problem } from './problems.js';
const fields = ['student_goal', 'exercise_group', 'equipment_tag', 'equipment_location'];
export function registerCoachOptions(
  app: FastifyInstance,
  options: {
    pool: Pool;
    context: (
      req: FastifyRequest,
      id: string,
      roles?: string[],
    ) => Promise<{ user: CurrentUser; org: OrganizationSummary }>;
  },
) {
  const params = {
    type: 'object',
    required: ['organizationId'],
    additionalProperties: false,
    properties: { organizationId: { type: 'string', format: 'uuid' } },
  };
  const root = '/v1/organizations/:organizationId/field-options';
  app.get<{ Params: { organizationId: string } }>(root, { schema: { params } }, async (req) => {
    const { user, org } = await options.context(req, req.params.organizationId, ['owner']);
    return actorTransaction(options.pool, user.id, org.id, async (db) => ({
      options: (
        await db.query(
          'SELECT id,field,value FROM coach_field_options WHERE organization_id=$1 ORDER BY field,lower(value),id',
          [org.id],
        )
      ).rows,
    }));
  });
  app.post<{ Params: { organizationId: string }; Body: { field: string; value: string } }>(
    root,
    {
      schema: {
        params,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['field', 'value'],
          properties: {
            field: { type: 'string', enum: fields },
            value: { type: 'string', minLength: 1, maxLength: 300 },
          },
        },
      },
    },
    async (req) => {
      const { user, org } = await options.context(req, req.params.organizationId, ['owner']);
      if (!req.body.value.trim()) throw problem(400, 'INVALID_COACH_OPTION', 'Escribe una opción.');
      const limit =
        req.body.field === 'student_goal'
          ? 300
          : req.body.field === 'equipment_location'
            ? 100
            : 60;
      if (req.body.value.trim().length > limit)
        throw problem(400, 'INVALID_COACH_OPTION', 'La opción supera el tamaño del campo.');
      return actorTransaction(options.pool, user.id, org.id, async (db) => {
        const id = (
          await db.query('SELECT app.save_coach_option($1,$2) id', [req.body.field, req.body.value])
        ).rows[0].id;
        return {
          option: (
            await db.query(
              'SELECT id,field,value FROM coach_field_options WHERE id=$1 AND organization_id=$2',
              [id, org.id],
            )
          ).rows[0],
        };
      });
    },
  );
}
