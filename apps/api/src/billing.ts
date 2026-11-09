import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { validMonth, type CurrentUser } from '@forma/shared';
import { actorTransaction, tenantSlug } from './organizations.js';
import { PrivateStorage } from './storage.js';
import { problem } from './problems.js';
import type { AppConfig } from './app.js';
interface Options {
  pool: Pool;
  config: AppConfig;
  requireUser: (r: FastifyRequest) => Promise<CurrentUser>;
}
const uuid = { type: 'string', format: 'uuid' },
  params = { type: 'object', required: ['organizationId'], properties: { organizationId: uuid } },
  itemParams = {
    type: 'object',
    required: ['organizationId', 'id'],
    properties: { organizationId: uuid, id: uuid },
  },
  root = '/v1/organizations/:organizationId/billing',
  textReason = { type: 'string', minLength: 10, maxLength: 500 };
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});
export async function registerBilling(
  app: FastifyInstance,
  { pool, config, requireUser }: Options,
) {
  app.get('/v1/admin/pilot-summary', async (req) => {
    const user = await requireUser(req);
    return actorTransaction(pool, user.id, null, async (db) => ({
      summary: (await db.query('SELECT app.pilot_summary() data')).rows[0].data,
    }));
  });
  const storage = new PrivateStorage(
    config.storageRoot ?? process.env.STORAGE_PATH ?? '.local/storage',
    2097152,
  );
  let transforms = 0;
  async function actor(request: FastifyRequest, org: string, write = false) {
    const user = await requireUser(request);
    if (write && !user.isSuperadmin)
      throw problem(403, 'FORBIDDEN', 'Solo la administración de plataforma registra movimientos.');
    const slug = tenantSlug(request.hostname, config.tenantBaseDomain);
    if (slug) {
      const brand = (await pool.query('SELECT app.public_brand($1) data', [slug])).rows[0]?.data;
      if (brand?.id !== org)
        throw problem(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró el estudio.');
    }
    await actorTransaction(pool, user.id, org, async (db) => {
      if (!(await db.query('SELECT app.billing_readable($1) allowed', [org])).rows[0].allowed)
        throw problem(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró el estudio.');
    });
    return user;
  }
  async function invoice(db: PoolClient, org: string, id: string) {
    const row = (
      await db.query(
        'SELECT *,month::text month_date,app.billing_balance(id) balance FROM saas_invoices WHERE organization_id=$1 AND id=$2',
        [org, id],
      )
    ).rows[0];
    if (!row) throw problem(404, 'BILLING_NOT_FOUND', 'No se encontró la cuenta.');
    const adjustments = (
        await db.query(
          'SELECT * FROM saas_adjustments WHERE organization_id=$1 AND invoice_id=$2 ORDER BY created_at,id',
          [org, id],
        )
      ).rows,
      payments = (
        await db.query(
          'SELECT p.*,p.paid_on::text paid_date,r.reason reversal_reason,r.created_at reversed_at FROM saas_payments p LEFT JOIN saas_payment_reversals r ON r.organization_id=p.organization_id AND r.payment_id=p.id WHERE p.organization_id=$1 AND p.invoice_id=$2 ORDER BY p.created_at,p.id',
          [org, id],
        )
      ).rows,
      adjustment = adjustments.reduce((n, r) => n + Number(r.amount_pyg), 0),
      paid = payments.filter((p) => !p.reversed_at).reduce((n, r) => n + Number(r.amount_pyg), 0),
      balance = Number(row.balance);
    return {
      id: row.id,
      month: row.month_date,
      issuedAt: row.issued_at.toISOString(),
      totalPyg: Number(row.total_pyg),
      adjustmentPyg: adjustment,
      paidPyg: paid,
      balancePyg: balance,
      status: balance === 0 ? 'settled' : paid ? 'partial' : 'issued',
      snapshot: row.snapshot,
      adjustments: adjustments.map((r) => ({
        id: r.id,
        amountPyg: Number(r.amount_pyg),
        reason: r.reason,
        createdAt: r.created_at.toISOString(),
      })),
      payments: payments.map((p) => ({
        id: p.id,
        amountPyg: Number(p.amount_pyg),
        reference: p.reference,
        paidOn: p.paid_date,
        createdAt: p.created_at.toISOString(),
        receiptUrl: p.receipt_key
          ? `/v1/organizations/${org}/billing/payments/${p.id}/receipt`
          : null,
        reversal: p.reversed_at
          ? { reason: p.reversal_reason, createdAt: p.reversed_at.toISOString() }
          : null,
      })),
    };
  }
  app.get<{ Params: { organizationId: string }; Querystring: { month: string } }>(
    root + '/preview',
    {
      schema: {
        params,
        querystring: object({ month: { type: 'string', pattern: '^20[0-9]{2}-(0[1-9]|1[0-2])$' } }),
      },
    },
    async (req) => {
      const org = req.params.organizationId,
        user = await actor(req, org);
      if (!validMonth(req.query.month))
        throw problem(400, 'INVALID_BILLING', 'Selecciona un mes válido.');
      return actorTransaction(pool, user.id, org, async (db) => ({
        preview: (
          await db.query('SELECT app.billing_preview($1,$2) data', [org, req.query.month + '-01'])
        ).rows[0].data,
      }));
    },
  );
  app.post<{ Params: { organizationId: string }; Body: { reason: string } }>(
    root + '/enable',
    { schema: { params, body: object({ reason: textReason }) } },
    async (req) => {
      const org = req.params.organizationId,
        user = await actor(req, org, true);
      await actorTransaction(pool, user.id, org, (db) =>
        db.query('SELECT app.billing_enroll($1,$2)', [org, req.body.reason]),
      );
      return { success: true };
    },
  );
  app.post<{ Params: { organizationId: string }; Body: { month: string } }>(
    root + '/issue',
    {
      schema: {
        params,
        body: object({ month: { type: 'string', pattern: '^20[0-9]{2}-(0[1-9]|1[0-2])$' } }),
      },
    },
    async (req) => {
      const org = req.params.organizationId,
        user = await actor(req, org, true);
      return actorTransaction(pool, user.id, org, async (db) => {
        const id = (
          await db.query('SELECT app.billing_issue($1,$2) id', [org, req.body.month + '-01'])
        ).rows[0].id;
        return { invoice: await invoice(db, org, id) };
      });
    },
  );
  app.get<{ Params: { organizationId: string }; Querystring: { before?: string; limit?: number } }>(
    root + '/invoices',
    {
      schema: {
        params,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            before: uuid,
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 12 },
          },
        },
      },
    },
    async (req) => {
      const org = req.params.organizationId,
        user = await actor(req, org),
        limit = req.query.limit ?? 12;
      return actorTransaction(pool, user.id, org, async (db) => {
        const rows = (
          await db.query(
            'SELECT id,month::text month_date,issued_at,total_pyg,app.billing_balance(id) balance FROM saas_invoices WHERE organization_id=$1 AND ($2::uuid IS NULL OR month<(SELECT month FROM saas_invoices WHERE id=$2 AND organization_id=$1)) ORDER BY month DESC LIMIT $3',
            [org, req.query.before ?? null, limit + 1],
          )
        ).rows;
        return {
          invoices: rows.slice(0, limit).map((r) => ({
            id: r.id,
            month: r.month_date,
            issuedAt: r.issued_at.toISOString(),
            totalPyg: Number(r.total_pyg),
            balancePyg: Number(r.balance),
          })),
          nextBefore: rows.length > limit ? rows[limit - 1].id : null,
        };
      });
    },
  );
  app.get<{ Params: { organizationId: string; id: string } }>(
    root + '/invoices/:id',
    { schema: { params: itemParams } },
    async (req) => {
      const org = req.params.organizationId,
        user = await actor(req, org);
      return actorTransaction(pool, user.id, org, async (db) => ({
        invoice: await invoice(db, org, req.params.id),
      }));
    },
  );
  function rawAmount(req: FastifyRequest) {
    const b = req.body as { amountPyg?: unknown };
    if (!b || typeof b.amountPyg !== 'number' || !Number.isSafeInteger(b.amountPyg))
      throw problem(400, 'INVALID_BILLING', 'Indica guaraníes enteros.');
  }
  app.post<{
    Params: { organizationId: string; id: string };
    Body: { requestId: string; amountPyg: number; reason: string };
  }>(
    root + '/invoices/:id/adjustments',
    {
      preValidation: async (req) => rawAmount(req),
      schema: {
        params: itemParams,
        body: object({
          requestId: uuid,
          amountPyg: { type: 'integer', minimum: -1e12, maximum: 1e12 },
          reason: textReason,
        }),
      },
    },
    async (req) => {
      const org = req.params.organizationId,
        user = await actor(req, org, true),
        b = req.body;
      return actorTransaction(pool, user.id, org, async (db) => {
        await db.query('SELECT app.billing_adjust($1,$2,$3,$4)', [
          req.params.id,
          b.requestId,
          b.amountPyg,
          b.reason,
        ]);
        return { invoice: await invoice(db, org, req.params.id) };
      });
    },
  );
  app.post<{
    Params: { organizationId: string; id: string };
    Body: {
      requestId: string;
      amountPyg: number;
      reference: string;
      paidOn: string;
      receiptDataUrl?: string;
    };
  }>(
    root + '/invoices/:id/payments',
    {
      bodyLimit: 2900000,
      onRequest: async (req) => {
        await actor(req, (req.params as { organizationId: string }).organizationId, true);
      },
      preValidation: async (req) => rawAmount(req),
      schema: {
        params: itemParams,
        body: object(
          {
            requestId: uuid,
            amountPyg: { type: 'integer', minimum: 1, maximum: 1e12 },
            reference: { type: 'string', minLength: 3, maxLength: 150 },
            paidOn: { type: 'string', format: 'date' },
            receiptDataUrl: { type: 'string', maxLength: 2800000 },
          },
          ['requestId', 'amountPyg', 'reference', 'paidOn'],
        ),
      },
    },
    async (req) => {
      const org = req.params.organizationId,
        user = await actor(req, org, true),
        b = req.body;
      let bytes: Buffer | undefined,
        hash: string | null = null;
      if (
        !/^20\d{2}-\d{2}-\d{2}$/.test(b.paidOn) ||
        !Number.isFinite(Date.parse(b.paidOn + 'T12:00:00Z')) ||
        new Date(b.paidOn + 'T12:00:00Z').toISOString().slice(0, 10) !== b.paidOn
      )
        throw problem(400, 'INVALID_BILLING', 'Revisa la fecha del pago.');
      if (b.receiptDataUrl) {
        const match = /^data:image\/(png|jpeg|webp);base64,([\w+/=]+)$/.exec(b.receiptDataUrl);
        if (!match) throw problem(400, 'INVALID_RECEIPT', 'Usa PNG, JPEG o WebP.');
        const input = Buffer.from(match[2]!, 'base64');
        if (!input.length || input.length > 2097152)
          throw problem(413, 'INVALID_RECEIPT', 'El comprobante supera 2 MB.');
        hash = createHash('sha256').update(input).digest('hex');
        if (transforms >= 2) throw problem(429, 'RECEIPT_BUSY', 'Espera y vuelve a intentar.');
        transforms++;
        try {
          const meta = await sharp(input, { limitInputPixels: 8388608 }).metadata();
          if ((meta.pages ?? 1) > 1 || !['png', 'jpeg', 'webp'].includes(meta.format ?? ''))
            throw new Error('format');
          bytes = await sharp(input, { limitInputPixels: 8388608 })
            .timeout({ seconds: 5 })
            .rotate()
            .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
          if (bytes.length > 2097152) throw new Error('size');
        } catch {
          throw problem(400, 'INVALID_RECEIPT', 'Imagen no válida, máximo 8 MP sin animación.');
        } finally {
          transforms--;
        }
      }
      let key: string | undefined,
        kept = false;
      try {
        const result = await actorTransaction(pool, user.id, org, async (db) => {
          await db.query('SELECT pg_advisory_xact_lock_shared(70321021)');
          if (bytes) key = await storage.put(bytes, 'webp');
          const id = (
            await db.query('SELECT app.billing_pay($1,$2,$3,$4,$5,$6,$7,$8) id', [
              req.params.id,
              b.requestId,
              b.amountPyg,
              b.reference,
              b.paidOn,
              key ?? null,
              hash,
              bytes?.length ?? 0,
            ])
          ).rows[0].id;
          const row = (
            await db.query(
              'SELECT receipt_key FROM saas_payments WHERE organization_id=$1 AND id=$2',
              [org, id],
            )
          ).rows[0];
          return { invoice: await invoice(db, org, req.params.id), storedKey: row.receipt_key };
        });
        kept = result.storedKey === key;
        return { invoice: result.invoice };
      } finally {
        if (key && !kept) await storage.remove(key).catch(() => {});
      }
    },
  );
  app.post<{
    Params: { organizationId: string; id: string };
    Body: { requestId: string; reason: string };
  }>(
    root + '/payments/:id/reverse',
    { schema: { params: itemParams, body: object({ requestId: uuid, reason: textReason }) } },
    async (req) => {
      const org = req.params.organizationId,
        user = await actor(req, org, true);
      await actorTransaction(pool, user.id, org, (db) =>
        db.query('SELECT app.billing_reverse($1,$2,$3)', [
          req.params.id,
          req.body.requestId,
          req.body.reason,
        ]),
      );
      return { success: true };
    },
  );
  app.get<{ Params: { organizationId: string; id: string } }>(
    root + '/payments/:id/receipt',
    { schema: { params: itemParams } },
    async (req, reply) => {
      const org = req.params.organizationId,
        user = await actor(req, org);
      const row = await actorTransaction(
        pool,
        user.id,
        org,
        async (db) =>
          (
            await db.query(
              'SELECT receipt_key FROM saas_payments WHERE organization_id=$1 AND id=$2',
              [org, req.params.id],
            )
          ).rows[0],
      );
      if (!row?.receipt_key)
        throw problem(404, 'BILLING_NOT_FOUND', 'No se encontró el comprobante.');
      try {
        return reply
          .header('Cache-Control', 'private, no-store')
          .header('Content-Type', 'image/webp')
          .header('Content-Disposition', 'inline; filename="receipt.webp"')
          .send(await storage.read(row.receipt_key));
      } catch {
        throw problem(404, 'BILLING_NOT_FOUND', 'Comprobante no disponible.');
      }
    },
  );
}
