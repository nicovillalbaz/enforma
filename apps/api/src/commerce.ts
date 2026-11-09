import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { FollowupOptions } from './followup.js';
import type { AppConfig } from './app.js';
import { actorTransaction } from './organizations.js';
import { PrivateStorage } from './storage.js';
import { problem } from './problems.js';
const uuid = { type: 'string', format: 'uuid' },
  date = { type: 'string', format: 'date' },
  revision = { type: 'integer', minimum: 0 },
  text = (max: number, min = 0) => ({ type: 'string', minLength: min, maxLength: max }),
  integer = (max: number, min = 0) => ({ type: 'integer', minimum: min, maximum: max }),
  object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
    type: 'object',
    additionalProperties: false,
    required,
    properties,
  }),
  params = object({ organizationId: uuid }),
  item = object({ organizationId: uuid, id: uuid }),
  request = { requestId: uuid },
  command = { ...request, revision },
  reason = text(500, 10),
  money = integer(1e12, 1),
  currency = { enum: ['PYG', 'USD', 'EUR'] },
  serviceDoc = object({
    name: text(100, 2),
    description: text(1000),
    kind: { enum: ['single', 'membership', 'package'] },
    currency,
    priceMinor: money,
    validityDays: integer(730, 1),
    sessions: integer(1000),
    capacity: integer(5000),
    archived: { type: 'boolean' },
  }),
  prospectDoc = object({
    name: text(100, 2),
    email: text(254),
    phone: text(40),
    source: text(100),
    stage: { enum: ['new', 'contacted', 'trial', 'lost'] },
    nextAction: text(300),
    nextOn: { type: ['string', 'null'], format: 'date' },
    notes: text(1000),
  });
type P = { organizationId: string; id: string };
// AJV coercion must not turn string/fractional financial values into a valid amount.
function rawMoney(req: FastifyRequest) {
  const visit = (v: unknown, depth = 0): void => {
    if (depth > 32) throw problem(400, 'INVALID_COMMERCE', 'Estructura no válida.');
    if (!v || typeof v !== 'object') return;
    for (const [key, value] of Object.entries(v)) {
      if (
        ['amountMinor', 'priceMinor'].includes(key) &&
        (typeof value !== 'number' || !Number.isSafeInteger(value))
      )
        throw problem(
          400,
          'INVALID_COMMERCE',
          'Introduce un importe exacto en la unidad mínima de su moneda.',
        );
      if (value && typeof value === 'object') visit(value, depth + 1);
    }
  };
  visit(req.body);
}
export async function registerCommerce(
  app: FastifyInstance,
  { pool, context, config }: FollowupOptions & { config: AppConfig },
) {
  const root = '/v1/organizations/:organizationId/commerce',
    storage = new PrivateStorage(
      config.storageRoot ?? process.env.STORAGE_PATH ?? '.local/storage',
      2097152,
    );
  let transforms = 0;
  async function run<T>(
    req: FastifyRequest,
    org: string,
    fn: (db: PoolClient) => Promise<T>,
    owner = false,
  ) {
    const { user } = await context(req, org, owner ? ['owner'] : undefined);
    return actorTransaction(pool, user.id, org, fn);
  }
  app.get<{ Params: P; Querystring: { q?: string; studentId?: string; before?: string } }>(
    root,
    {
      schema: { params, querystring: object({ q: text(100), studentId: uuid, before: uuid }, []) },
    },
    async (req) =>
      run(req, req.params.organizationId, async (db) => {
        const meta = (
          await db.query(
            'SELECT timezone,(now() AT TIME ZONE timezone)::date::text today,app.coach_owner() owner FROM organizations WHERE id=app.tenant()',
          )
        ).rows[0];
        const rows = (
          await db.query(
            `SELECT id,app.coach_contract_info(id) data FROM coach_contracts WHERE ($1::uuid IS NULL OR student_id=$1) AND ($2::uuid IS NULL OR(created_at,id)<(SELECT created_at,id FROM coach_contracts WHERE id=$2)) AND ($3='' OR snapshot->>'name' ILIKE '%'||$3||'%' OR EXISTS(SELECT 1 FROM students s WHERE s.id=student_id AND s.display_name ILIKE '%'||$3||'%')) ORDER BY created_at DESC,id DESC LIMIT 51`,
            [req.query.studentId ?? null, req.query.before ?? null, req.query.q ?? ''],
          )
        ).rows;
        return {
          ...meta,
          services: meta.owner
            ? (
                await db.query(
                  'SELECT app.coach_service_info(id) data FROM coach_services ORDER BY archived,name,id LIMIT 300',
                )
              ).rows.map((r) => r.data)
            : [],
          contracts: rows.slice(0, 50).map((r) => r.data),
          nextCursor: rows.length > 50 ? rows[49].id : null,
          students: meta.owner
            ? (
                await db.query(
                  "SELECT id,display_name name,status FROM students WHERE status<>'archived' AND display_name ILIKE '%'||$1||'%' ORDER BY display_name,id LIMIT 100",
                  [req.query.q ?? ''],
                )
              ).rows
            : [],
        };
      }),
  );
  app.put<{ Params: P; Body: { requestId: string; revision: number; document: unknown } }>(
    root + '/services/:id',
    {
      preValidation: async (req) => rawMoney(req),
      schema: { params: item, body: object({ ...command, document: serviceDoc }) },
    },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.coach_save_service($1,$2,$3,$4) data', [
              req.params.id,
              req.body.revision,
              req.body.requestId,
              req.body.document,
            ])
          ).rows[0].data,
        true,
      ),
  );
  app.put<{ Params: P; Body: { requestId: string; document: unknown } }>(
    root + '/contracts/:id',
    {
      preValidation: async (req) => rawMoney(req),
      schema: {
        params: item,
        body: object({
          ...request,
          document: object({
            studentId: uuid,
            serviceId: uuid,
            serviceRevision: revision,
            startsOn: date,
            renewalOf: { type: ['string', 'null'], format: 'uuid' },
            installments: {
              type: 'array',
              minItems: 1,
              maxItems: 24,
              items: object({ dueOn: date, amountMinor: money }),
            },
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
            await db.query('SELECT app.coach_sell($1,$2,$3) data', [
              req.params.id,
              req.body.requestId,
              req.body.document,
            ])
          ).rows[0].data,
        true,
      ),
  );
  app.get<{ Params: P }>(root + '/contracts/:id', { schema: { params: item } }, async (req) =>
    run(req, req.params.organizationId, async (db) => {
      const contract = (await db.query('SELECT app.coach_contract_info($1) data', [req.params.id]))
        .rows[0].data;
      if (!contract) throw problem(404, 'COACH_NOT_FOUND', 'El contrato no está disponible.');
      const charges = (
        await db.query(
          `SELECT c.id,c.ordinal,c.due_on::text "dueOn",c.amount_minor::float8 "amountMinor",app.coach_charge_totals(c.id) totals,
      coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'amountMinor',p.amount_minor,'paidOn',p.paid_on,'method',p.method,'reference',p.reference,'returnedMinor',(SELECT coalesce(sum(amount_minor),0) FROM coach_refunds WHERE payment_id=p.id),'corrected',EXISTS(SELECT 1 FROM coach_refunds WHERE payment_id=p.id AND kind='correction'),'receiptUrl',CASE WHEN p.receipt_key IS NOT NULL THEN $2||'/payments/'||p.id||'/receipt' END) ORDER BY p.created_at,p.id) FROM coach_payments p WHERE p.charge_id=c.id),'[]') payments,
      coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'amountMinor',a.amount_minor,'reason',a.reason,'createdAt',a.created_at) ORDER BY a.created_at,a.id) FROM coach_adjustments a WHERE a.charge_id=c.id),'[]') adjustments
      FROM coach_charges c WHERE contract_id=$1 ORDER BY ordinal`,
          [req.params.id, `/v1/organizations/${req.params.organizationId}/commerce`],
        )
      ).rows.map(({ totals, ...r }) => ({ ...r, ...totals }));
      const refunds = (
        await db.query(
          `SELECT r.id,r.payment_id "paymentId",r.amount_minor::float8 "amountMinor",r.kind,r.reason,r.returned_on::text "returnedOn" FROM coach_refunds r JOIN coach_payments p ON p.id=r.payment_id JOIN coach_charges c ON c.id=p.charge_id WHERE c.contract_id=$1 ORDER BY r.created_at,r.id`,
          [req.params.id],
        )
      ).rows;
      const sessions = (
        await db.query(
          'SELECT id,kind,booking_id "bookingId",use_id "useId",reason,created_at "createdAt" FROM coach_session_entries WHERE contract_id=$1 ORDER BY created_at,id',
          [req.params.id],
        )
      ).rows;
      const eligibleBookings = (
        await db.query(
          `SELECT b.id,e.title,b.starts_at "startsAt" FROM agenda_bookings b JOIN agenda_events e ON e.id=b.event_id JOIN organizations o ON o.id=b.organization_id WHERE app.coach_owner() AND b.student_id=$1 AND b.status='confirmed' AND b.attendance='attended' AND(b.starts_at AT TIME ZONE o.timezone)::date BETWEEN $2::date AND $3::date AND NOT EXISTS(SELECT 1 FROM coach_session_entries WHERE booking_id=b.id) ORDER BY b.starts_at DESC,b.id LIMIT 50`,
          [contract.studentId, contract.startsOn, contract.endsOn],
        )
      ).rows;
      return { contract, charges, refunds, sessions, eligibleBookings };
    }),
  );
  app.post<{ Params: P; Body: { requestId: string; revision: number; reason: string } }>(
    root + '/contracts/:id/cancel',
    { schema: { params: item, body: object({ ...command, reason }) } },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.coach_cancel_contract($1,$2,$3,$4) data', [
              req.params.id,
              req.body.revision,
              req.body.requestId,
              req.body.reason,
            ])
          ).rows[0].data,
        true,
      ),
  );
  app.post<{ Params: P; Body: { requestId: string; amountMinor: number; reason: string } }>(
    root + '/charges/:id/adjust',
    {
      preValidation: async (req) => rawMoney(req),
      schema: {
        params: item,
        body: object({ ...request, amountMinor: integer(1e12, -1e12), reason }),
      },
    },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.coach_adjust($1,$2,$3,$4) data', [
              req.params.id,
              req.body.requestId,
              req.body.amountMinor,
              req.body.reason,
            ])
          ).rows[0].data,
        true,
      ),
  );
  app.post<{
    Params: P;
    Body: {
      requestId: string;
      amountMinor: number;
      paidOn: string;
      method: string;
      reference: string;
      receiptDataUrl?: string;
    };
  }>(
    root + '/charges/:id/payments',
    {
      bodyLimit: 2900000,
      onRequest: async (req) => {
        await context(req, (req.params as P).organizationId, ['owner']);
      },
      preValidation: async (req) => rawMoney(req),
      schema: {
        params: item,
        body: object(
          {
            ...request,
            amountMinor: money,
            paidOn: date,
            method: { enum: ['cash', 'transfer', 'other'] },
            reference: text(150, 3),
            receiptDataUrl: text(2800000),
          },
          ['requestId', 'amountMinor', 'paidOn', 'method', 'reference'],
        ),
      },
    },
    async (req) => {
      let bytes: Buffer | undefined,
        hash: string | null = null,
        key: string | undefined,
        kept = false;
      if (req.body.receiptDataUrl) {
        const match = /^data:image\/(png|jpeg|webp);base64,([\w+/=]+)$/.exec(
          req.body.receiptDataUrl,
        );
        if (!match) throw problem(400, 'INVALID_RECEIPT', 'Usa una imagen PNG, JPEG o WebP.');
        const input = Buffer.from(match[2]!, 'base64');
        if (!input.length || input.length > 2097152)
          throw problem(413, 'INVALID_RECEIPT', 'Máximo 2 MB.');
        hash = createHash('sha256').update(input).digest('hex');
        if (transforms >= 1)
          throw problem(429, 'RECEIPT_BUSY', 'Espera antes de subir otro comprobante.');
        transforms++;
        try {
          const meta = await sharp(input, { limitInputPixels: 8388608 }).metadata();
          if ((meta.pages ?? 1) > 1 || !['png', 'jpeg', 'webp'].includes(meta.format ?? ''))
            throw Error('format');
          bytes = await sharp(input, { limitInputPixels: 8388608 })
            .timeout({ seconds: 5 })
            .rotate()
            .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
        } catch {
          throw problem(400, 'INVALID_RECEIPT', 'Imagen no válida; máximo 8 MP sin animación.');
        } finally {
          transforms--;
        }
      }
      try {
        const result = await run(
          req,
          req.params.organizationId,
          async (db) => {
            await db.query('SELECT pg_advisory_xact_lock_shared(70321021)');
            if (bytes) key = await storage.put(bytes, 'webp');
            const data = (
              await db.query('SELECT app.coach_pay($1,$2,$3,$4,$5,$6,$7,$8,$9) data', [
                req.params.id,
                req.body.requestId,
                req.body.amountMinor,
                req.body.paidOn,
                req.body.method,
                req.body.reference,
                key ?? null,
                hash,
                bytes?.length ?? 0,
              ])
            ).rows[0].data;
            const stored = (
              await db.query('SELECT receipt_key FROM coach_payments WHERE id=$1', [data.id])
            ).rows[0];
            return { data, storedKey: stored.receipt_key };
          },
          true,
        );
        kept = result.storedKey === key;
        return result.data;
      } finally {
        if (key && !kept) await storage.remove(key).catch(() => {});
      }
    },
  );
  app.post<{
    Params: P;
    Body: {
      requestId: string;
      amountMinor: number;
      returnedOn: string;
      kind: string;
      reason: string;
    };
  }>(
    root + '/payments/:id/return',
    {
      preValidation: async (req) => rawMoney(req),
      schema: {
        params: item,
        body: object({
          ...request,
          amountMinor: money,
          returnedOn: date,
          kind: { enum: ['refund', 'correction'] },
          reason,
        }),
      },
    },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.coach_return($1,$2,$3,$4,$5,$6) data', [
              req.params.id,
              req.body.requestId,
              req.body.amountMinor,
              req.body.returnedOn,
              req.body.kind,
              req.body.reason,
            ])
          ).rows[0].data,
        true,
      ),
  );
  app.get<{ Params: P }>(
    root + '/payments/:id/receipt',
    { schema: { params: item } },
    async (req, reply) => {
      // Keep the authorization transaction open while reading bytes, so no public path/token is exposed.
      const bytes = await run(req, req.params.organizationId, async (db) => {
        const row = (
          await db.query('SELECT receipt_key FROM coach_payments WHERE id=$1', [req.params.id])
        ).rows[0];
        if (!row?.receipt_key) throw problem(404, 'COACH_NOT_FOUND', 'Comprobante no disponible.');
        try {
          return await storage.read(row.receipt_key);
        } catch {
          throw problem(404, 'COACH_NOT_FOUND', 'Comprobante no disponible.');
        }
      });
      return reply
        .header('Cache-Control', 'private, no-store')
        .header('Content-Type', 'image/webp')
        .header('Content-Disposition', 'inline; filename="comprobante.webp"')
        .send(bytes);
    },
  );
  app.post<{
    Params: P;
    Body: { requestId: string; kind: string; referenceId: string; reason: string };
  }>(
    root + '/contracts/:id/sessions',
    {
      schema: {
        params: item,
        body: object({ ...request, kind: { enum: ['use', 'restore'] }, referenceId: uuid, reason }),
      },
    },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.coach_session($1,$2,$3,$4,$5) data', [
              req.params.id,
              req.body.requestId,
              req.body.kind,
              req.body.referenceId,
              req.body.reason,
            ])
          ).rows[0].data,
        true,
      ),
  );
  app.get<{ Params: P; Querystring: { q?: string; stage?: string; before?: string } }>(
    root + '/prospects',
    {
      schema: {
        params,
        querystring: object(
          {
            q: text(100),
            stage: { enum: ['new', 'contacted', 'trial', 'won', 'lost', 'erased'] },
            before: uuid,
          },
          [],
        ),
      },
    },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) => {
          const rows = (
            await db.query(
              `SELECT id,name,email,phone,source,stage,next_action "nextAction",next_on::text "nextOn",notes,revision,student_id "studentId",created_at "createdAt" FROM coach_prospects WHERE($1::text IS NULL OR stage=$1) AND(name ILIKE '%'||$2||'%' OR email ILIKE '%'||$2||'%') AND($3::uuid IS NULL OR(updated_at,id)<(SELECT updated_at,id FROM coach_prospects WHERE id=$3)) ORDER BY updated_at DESC,id DESC LIMIT 51`,
              [req.query.stage ?? null, req.query.q ?? '', req.query.before ?? null],
            )
          ).rows;
          return {
            prospects: rows.slice(0, 50),
            nextCursor: rows.length > 50 ? rows[49].id : null,
          };
        },
        true,
      ),
  );
  app.put<{ Params: P; Body: { requestId: string; revision: number; document: unknown } }>(
    root + '/prospects/:id',
    { schema: { params: item, body: object({ ...command, document: prospectDoc }) } },
    async (req) =>
      run(
        req,
        req.params.organizationId,
        async (db) =>
          (
            await db.query('SELECT app.coach_save_prospect($1,$2,$3,$4) data', [
              req.params.id,
              req.body.revision,
              req.body.requestId,
              req.body.document,
            ])
          ).rows[0].data,
        true,
      ),
  );
  for (const action of ['convert', 'erase'] as const)
    app.post<{ Params: P; Body: { requestId: string; revision: number } }>(
      root + '/prospects/:id/' + action,
      { schema: { params: item, body: object(command) } },
      async (req) =>
        run(
          req,
          req.params.organizationId,
          async (db) =>
            (
              await db.query(`SELECT app.coach_${action}_prospect($1,$2,$3) data`, [
                req.params.id,
                req.body.revision,
                req.body.requestId,
              ])
            ).rows[0].data,
          true,
        ),
    );
  app.get<{ Params: P; Querystring: { from: string; to: string; csv?: string } }>(
    root + '/reports',
    {
      schema: {
        params,
        querystring: object({ from: date, to: date, csv: { enum: ['1'], type: 'string' } }, [
          'from',
          'to',
        ]),
      },
    },
    async (req, reply) => {
      const { from, to } = req.query;
      if (Date.parse(to) < Date.parse(from) || Date.parse(to) - Date.parse(from) > 365 * 86400000)
        throw problem(400, 'INVALID_COMMERCE', 'Selecciona hasta 366 días.');
      const report = await run(
        req,
        req.params.organizationId,
        async (db) => {
          const rows = (
            await db.query(
              `WITH currencies AS(SELECT unnest(ARRAY['PYG','USD','EUR'])currency),sale AS(SELECT c.currency,count(*)::int sales,sum(total_minor)::text n FROM coach_contracts c JOIN organizations o ON o.id=c.organization_id WHERE(c.created_at AT TIME ZONE o.timezone)::date BETWEEN $1 AND $2 GROUP BY c.currency),cancel AS(SELECT c.currency,count(*)::int n FROM coach_contracts c JOIN organizations o ON o.id=c.organization_id WHERE(c.cancelled_at AT TIME ZONE o.timezone)::date BETWEEN $1 AND $2 GROUP BY c.currency),expire AS(SELECT currency,count(*)::int n FROM coach_contracts WHERE cancelled_at IS NULL AND ends_on BETWEEN $1 AND least($2::date,(SELECT(now() AT TIME ZONE timezone)::date-1 FROM organizations WHERE id=app.tenant())) GROUP BY currency),cash AS(SELECT c.currency,sum(p.amount_minor) n FROM coach_payments p JOIN coach_charges h ON h.id=p.charge_id JOIN coach_contracts c ON c.id=h.contract_id WHERE p.paid_on BETWEEN $1 AND $2 AND NOT EXISTS(SELECT 1 FROM coach_refunds WHERE payment_id=p.id AND kind='correction') GROUP BY c.currency),returns AS(SELECT c.currency,sum(r.amount_minor) n FROM coach_refunds r JOIN coach_payments p ON p.id=r.payment_id JOIN coach_charges h ON h.id=p.charge_id JOIN coach_contracts c ON c.id=h.contract_id WHERE r.kind='refund' AND r.returned_on BETWEEN $1 AND $2 GROUP BY c.currency),debt AS(SELECT c.currency,sum((app.coach_charge_totals(h.id)->>'balanceMinor')::bigint)n,sum(CASE WHEN h.due_on<(now() AT TIME ZONE o.timezone)::date THEN(app.coach_charge_totals(h.id)->>'balanceMinor')::bigint ELSE 0 END)overdue FROM coach_charges h JOIN coach_contracts c ON c.id=h.contract_id JOIN organizations o ON o.id=c.organization_id WHERE h.due_on BETWEEN $1 AND $2 GROUP BY c.currency) SELECT u.currency,coalesce(s.n,'0') "salesMinor",coalesce(s.sales,0) sales,coalesce(x.n,0) cancellations,coalesce(e.n,0) expirations,coalesce(p.n,0)::text "grossMinor",coalesce(r.n,0)::text "refundsMinor",(coalesce(p.n,0)-coalesce(r.n,0))::text "netMinor",coalesce(d.n,0)::text "dueMinor",coalesce(d.overdue,0)::text "overdueMinor" FROM currencies u LEFT JOIN sale s USING(currency) LEFT JOIN cancel x USING(currency) LEFT JOIN expire e USING(currency) LEFT JOIN cash p USING(currency) LEFT JOIN returns r USING(currency) LEFT JOIN debt d USING(currency)`,
              [from, to],
            )
          ).rows;
          await db.query(
            "INSERT INTO audit_logs(organization_id,actor_user_id,action,metadata)VALUES(app.tenant(),app.actor(),$1,jsonb_build_object('from',$2::text,'to',$3::text))",
            [req.query.csv ? 'coach.report_exported' : 'coach.report_read', from, to],
          );
          return { from, to, summary: rows };
        },
        true,
      );
      if (!req.query.csv) return report;
      const columns = [
        'currency',
        'sales',
        'cancellations',
        'expirations',
        'salesMinor',
        'grossMinor',
        'refundsMinor',
        'netMinor',
        'dueMinor',
        'overdueMinor',
      ];
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="resumen-coach.csv"')
        .send(
          '\uFEFF' +
            columns.join(',') +
            '\r\n' +
            report.summary.map((row) => columns.map((k) => String(row[k])).join(',')).join('\r\n') +
            '\r\n',
        );
    },
  );
}
