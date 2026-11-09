import type { FastifyInstance } from 'fastify';
import type { FollowupOptions } from './followup.js';
import { actorTransaction } from './organizations.js';
export async function registerCoachStart(app: FastifyInstance, { pool, context }: FollowupOptions) {
  app.get<{ Params: { organizationId: string } }>(
    '/v1/organizations/:organizationId/coach-start',
    {
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['organizationId'],
          properties: { organizationId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (req) => {
      const { user, org } = await context(req, req.params.organizationId, ['owner']);
      return actorTransaction(
        pool,
        user.id,
        org.id,
        async (db) => (await db.query('SELECT app.coach_start_overview() data')).rows[0].data,
      );
    },
  );
}
