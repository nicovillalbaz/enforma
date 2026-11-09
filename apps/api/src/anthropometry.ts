import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import {
  calculateAnthropometry,
  validAnthropometryInput,
  type AnthropometryAssessment,
  type AnthropometryInput,
  type AnthropometryResult,
} from '@forma/shared';
import type { CurrentUser, OrganizationSummary } from '@forma/shared';
import { actorTransaction } from './organizations.js';
import { problem } from './problems.js';
import { workbook, type WorkbookSheet } from './xlsx.js';

interface Options {
  pool: Pool;
  context: (
    request: FastifyRequest,
    id: string,
    roles?: string[],
  ) => Promise<{ user: CurrentUser; org: OrganizationSummary }>;
}
type Params = { organizationId: string; studentId: string; id?: string };
const uuid = { type: 'string', format: 'uuid' };
const params = {
  type: 'object',
  required: ['organizationId', 'studentId'],
  properties: { organizationId: uuid, studentId: uuid },
};
const itemParams = {
  type: 'object',
  required: ['organizationId', 'studentId', 'id'],
  properties: { ...params.properties, id: uuid },
};
const root = '/v1/organizations/:organizationId/anthropometry/:studentId';
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const dateValid = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value + 'T12:00:00Z')) &&
  new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
interface AssessmentRow {
  protocol: AnthropometryInput['protocol'];
  assessed_on: Date | string;
  instrument: string;
  notes: string;
  observations: AnthropometryInput['observations'];
  equation_population: AnthropometryInput['equationPopulation'];
  age_years: number | null;
  external_body_fat_percent: number | string | null;
  external_device: string;
  external_algorithm: string;
  id: string;
  student_id: string;
  status: AnthropometryAssessment['status'];
  revision: number;
  result: AnthropometryResult | null;
  correction_of: string | null;
  correction_reason: string | null;
  void_reason: string | null;
  created_at: Date;
  finalized_at: Date | null;
}
const inputOf = (row: AssessmentRow): AnthropometryInput => ({
  protocol: row.protocol,
  assessedOn:
    row.assessed_on instanceof Date
      ? row.assessed_on.toISOString().slice(0, 10)
      : String(row.assessed_on),
  instrument: row.instrument,
  notes: row.notes,
  observations: row.observations,
  equationPopulation: row.equation_population,
  ageYears: row.age_years,
  externalBodyFatPercent:
    row.external_body_fat_percent === null ? null : Number(row.external_body_fat_percent),
  externalDevice: row.external_device,
  externalAlgorithm: row.external_algorithm,
});
const dto = (row: AssessmentRow): AnthropometryAssessment => ({
  ...inputOf(row),
  id: row.id,
  studentId: row.student_id,
  status: row.status,
  revision: row.revision,
  result: row.result,
  correctionOf: row.correction_of,
  correctionReason: row.correction_reason,
  voidReason: row.void_reason,
  createdAt: (row.created_at as Date).toISOString(),
  finalizedAt: row.finalized_at ? (row.finalized_at as Date).toISOString() : null,
});
function checkedInput(value: unknown) {
  if (
    !validAnthropometryInput(value) ||
    value.assessedOn > today() ||
    value.assessedOn < '2000-01-01' ||
    ((value.protocol === 'bia' || value.protocol === 'dxa') && !value.externalDevice.trim())
  )
    throw problem(400, 'INVALID_ANTHROPOMETRY', 'Revisa protocolo, fecha, lecturas y unidades.');
  return value;
}
async function access(db: PoolClient, org: string, student: string, owner: boolean) {
  const row = (
    await db.query(
      'SELECT EXISTS(SELECT 1 FROM students WHERE organization_id=$1 AND id=$2) found,app.progress_self($2) self',
      [org, student],
    )
  ).rows[0];
  if (!row?.found || (!owner && !row.self))
    throw problem(404, 'STUDENT_NOT_FOUND', 'No se encontró el alumno.');
}
function owned(org: OrganizationSummary) {
  if (org.role !== 'owner')
    throw problem(403, 'FORBIDDEN', 'Solo el coach puede registrar evaluaciones.');
}
async function rowFor(db: PoolClient, org: string, student: string, id: string, lock = false) {
  const row = (
    await db.query(
      `SELECT * FROM anthropometry_assessments WHERE organization_id=$1 AND student_id=$2 AND id=$3${lock ? ' FOR UPDATE' : ''}`,
      [org, student, id],
    )
  ).rows[0];
  if (!row) throw problem(404, 'ANTHROPOMETRY_NOT_FOUND', 'No se encontró la evaluación.');
  return row;
}
function sameInput(a: AnthropometryInput, b: AnthropometryInput) {
  return JSON.stringify(a) === JSON.stringify(b);
}
const audit = (
  db: PoolClient,
  org: string,
  actor: string,
  action: string,
  student: string,
  id: string,
) =>
  db.query(
    "INSERT INTO audit_logs(organization_id,actor_user_id,action,metadata) VALUES($1,$2,$3,jsonb_build_object('studentId',$4::uuid,'assessmentId',$5::uuid))",
    [org, actor, action, student, id],
  );

export async function registerAnthropometry(app: FastifyInstance, { pool, context }: Options) {
  app.get<{ Params: Params; Querystring: { from?: string; to?: string } }>(
    root,
    {
      schema: {
        params,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            from: { type: 'string', format: 'date' },
            to: { type: 'string', format: 'date' },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      const to = request.query.to ?? today();
      const from =
        request.query.from ??
        new Date(Date.parse(to + 'T12:00:00Z') - 365 * 86400000).toISOString().slice(0, 10);
      const span = (Date.parse(to + 'T12:00:00Z') - Date.parse(from + 'T12:00:00Z')) / 86400000;
      if (
        !dateValid(from) ||
        !dateValid(to) ||
        to > today() ||
        !Number.isInteger(span) ||
        span < 0 ||
        span > 366
      )
        throw problem(400, 'INVALID_RANGE', 'Elige un periodo de hasta un año.');
      return actorTransaction(pool, user.id, org.id, async (db) => {
        await access(db, org.id, request.params.studentId, org.role === 'owner');
        const rows = (
          await db.query(
            `SELECT * FROM anthropometry_assessments WHERE organization_id=$1 AND student_id=$2
         AND assessed_on BETWEEN $3 AND $4 AND ($5::boolean OR status='final')
         ORDER BY assessed_on DESC,created_at DESC,id DESC LIMIT 201`,
            [org.id, request.params.studentId, from, to, org.role === 'owner'],
          )
        ).rows;
        if (rows.length > 200) throw problem(413, 'ANTHROPOMETRY_LIMIT', 'Elige un periodo menor.');
        return { assessments: rows.map(dto), from, to };
      });
    },
  );
  app.get<{ Params: Params }>(
    root + '/:id',
    { schema: { params: itemParams } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        await access(db, org.id, request.params.studentId, org.role === 'owner');
        return {
          assessment: dto(await rowFor(db, org.id, request.params.studentId, request.params.id!)),
        };
      });
    },
  );
  app.post<{ Params: Params; Body: { requestId: string; input: AnthropometryInput } }>(
    root,
    {
      schema: {
        params,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['requestId', 'input'],
          properties: { requestId: uuid, input: { type: 'object' } },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      owned(org);
      const input = checkedInput(request.body.input);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        await access(db, org.id, request.params.studentId, true);
        const existing = (
          await db.query(
            'SELECT * FROM anthropometry_assessments WHERE organization_id=$1 AND student_id=$2 AND request_id=$3',
            [org.id, request.params.studentId, request.body.requestId],
          )
        ).rows[0];
        if (existing) {
          if (!sameInput(inputOf(existing), input))
            throw problem(409, 'IDEMPOTENCY_CONFLICT', 'La intención ya se usó con otros datos.');
          return { assessment: dto(existing) };
        }
        const count = (
          await db.query(
            'SELECT count(*)::integer n FROM anthropometry_assessments WHERE organization_id=$1 AND student_id=$2',
            [org.id, request.params.studentId],
          )
        ).rows[0].n;
        if (count >= 5000)
          throw problem(409, 'ANTHROPOMETRY_LIMIT', 'Se alcanzó el límite de evaluaciones.');
        const row = (
          await db.query(
            `INSERT INTO anthropometry_assessments(organization_id,student_id,request_id,protocol,assessed_on,
         instrument,notes,observations,equation_population,age_years,external_body_fat_percent,
         external_device,external_algorithm,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [
              org.id,
              request.params.studentId,
              request.body.requestId,
              input.protocol,
              input.assessedOn,
              input.instrument,
              input.notes,
              JSON.stringify(input.observations),
              input.equationPopulation,
              input.ageYears,
              input.externalBodyFatPercent,
              input.externalDevice,
              input.externalAlgorithm,
              user.id,
            ],
          )
        ).rows[0];
        await audit(
          db,
          org.id,
          user.id,
          'anthropometry.draft_created',
          request.params.studentId,
          row.id,
        );
        return { assessment: dto(row) };
      });
    },
  );
  app.put<{ Params: Params; Body: { revision: number; input: AnthropometryInput } }>(
    root + '/:id',
    {
      schema: {
        params: itemParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['revision', 'input'],
          properties: { revision: { type: 'integer', minimum: 1 }, input: { type: 'object' } },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      owned(org);
      const input = checkedInput(request.body.input);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const old = await rowFor(db, org.id, request.params.studentId, request.params.id!, true);
        if (old.status !== 'draft')
          throw problem(
            409,
            'ANTHROPOMETRY_FINAL',
            'La evaluación final no se edita. Crea una corrección.',
          );
        if (old.revision !== request.body.revision)
          throw problem(409, 'STALE_ANTHROPOMETRY', 'Actualiza la evaluación antes de guardar.');
        const row = (
          await db.query(
            `UPDATE anthropometry_assessments SET protocol=$4,assessed_on=$5,instrument=$6,notes=$7,
         observations=$8::jsonb,equation_population=$9,age_years=$10,external_body_fat_percent=$11,
         external_device=$12,external_algorithm=$13,revision=revision+1
         WHERE organization_id=$1 AND student_id=$2 AND id=$3 RETURNING *`,
            [
              org.id,
              request.params.studentId,
              old.id,
              input.protocol,
              input.assessedOn,
              input.instrument,
              input.notes,
              JSON.stringify(input.observations),
              input.equationPopulation,
              input.ageYears,
              input.externalBodyFatPercent,
              input.externalDevice,
              input.externalAlgorithm,
            ],
          )
        ).rows[0];
        await audit(
          db,
          org.id,
          user.id,
          'anthropometry.draft_updated',
          request.params.studentId,
          row.id,
        );
        return { assessment: dto(row) };
      });
    },
  );
  app.post<{ Params: Params; Body: { revision: number } }>(
    root + '/:id/finalize',
    {
      schema: {
        params: itemParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['revision'],
          properties: { revision: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      owned(org);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const old = await rowFor(db, org.id, request.params.studentId, request.params.id!, true);
        if (old.status !== 'draft' || old.revision !== request.body.revision)
          throw problem(409, 'STALE_ANTHROPOMETRY', 'Actualiza el borrador antes de finalizar.');
        const input = checkedInput(inputOf(old));
        if (input.protocol !== 'bia' && input.protocol !== 'dxa' && input.observations.length === 0)
          throw problem(400, 'INVALID_ANTHROPOMETRY', 'Registra al menos una medida.');
        const result = calculateAnthropometry(input);
        if (old.correction_of) {
          const replaced = await rowFor(
            db,
            org.id,
            request.params.studentId,
            old.correction_of,
            true,
          );
          if (replaced.status !== 'final')
            throw problem(409, 'STALE_ANTHROPOMETRY', 'El registro corregido ya no está vigente.');
          await db.query(
            `UPDATE anthropometry_assessments SET status='void',void_reason=$4,voided_by=$5,
          voided_at=clock_timestamp(),revision=revision+1 WHERE organization_id=$1 AND student_id=$2 AND id=$3`,
            [org.id, request.params.studentId, replaced.id, old.correction_reason, user.id],
          );
        }
        const row = (
          await db.query(
            `UPDATE anthropometry_assessments SET status='final',result=$4::jsonb,
        finalized_at=clock_timestamp(),revision=revision+1 WHERE organization_id=$1 AND student_id=$2 AND id=$3 RETURNING *`,
            [org.id, request.params.studentId, old.id, JSON.stringify(result)],
          )
        ).rows[0];
        await audit(
          db,
          org.id,
          user.id,
          'anthropometry.finalized',
          request.params.studentId,
          row.id,
        );
        return { assessment: dto(row) };
      });
    },
  );
  app.post<{ Params: Params; Body: { reason: string; requestId: string } }>(
    root + '/:id/correct',
    {
      schema: {
        params: itemParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['reason', 'requestId'],
          properties: { reason: { type: 'string', minLength: 3, maxLength: 200 }, requestId: uuid },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      owned(org);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const old = await rowFor(db, org.id, request.params.studentId, request.params.id!, true);
        if (old.status !== 'final')
          throw problem(
            409,
            'ANTHROPOMETRY_FINAL',
            'Solo una evaluación final vigente se puede corregir.',
          );
        const existing = (
          await db.query(
            'SELECT * FROM anthropometry_assessments WHERE organization_id=$1 AND student_id=$2 AND request_id=$3',
            [org.id, request.params.studentId, request.body.requestId],
          )
        ).rows[0];
        if (existing) {
          if (
            existing.correction_of !== old.id ||
            existing.correction_reason !== request.body.reason.trim()
          )
            throw problem(409, 'IDEMPOTENCY_CONFLICT', 'La intención ya se usó con otros datos.');
          return { assessment: dto(existing) };
        }
        const row = (
          await db.query(
            `INSERT INTO anthropometry_assessments(organization_id,student_id,request_id,
        protocol,assessed_on,instrument,notes,observations,equation_population,age_years,
        external_body_fat_percent,external_device,external_algorithm,created_by,correction_of,correction_reason)
        SELECT organization_id,student_id,$4,protocol,assessed_on,instrument,notes,observations,equation_population,
        age_years,external_body_fat_percent,external_device,external_algorithm,$5,id,$6
        FROM anthropometry_assessments WHERE organization_id=$1 AND student_id=$2 AND id=$3 RETURNING *`,
            [
              org.id,
              request.params.studentId,
              old.id,
              request.body.requestId,
              user.id,
              request.body.reason.trim(),
            ],
          )
        ).rows[0];
        await audit(
          db,
          org.id,
          user.id,
          'anthropometry.correction_started',
          request.params.studentId,
          row.id,
        );
        return { assessment: dto(row) };
      });
    },
  );
  app.post<{ Params: Params; Body: { reason: string; revision: number } }>(
    root + '/:id/void',
    {
      schema: {
        params: itemParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['reason', 'revision'],
          properties: {
            reason: { type: 'string', minLength: 3, maxLength: 200 },
            revision: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      owned(org);
      return actorTransaction(pool, user.id, org.id, async (db) => {
        const old = await rowFor(db, org.id, request.params.studentId, request.params.id!, true);
        if (old.status === 'void' || old.revision !== request.body.revision)
          throw problem(409, 'STALE_ANTHROPOMETRY', 'Actualiza el registro antes de anular.');
        const row = (
          await db.query(
            `UPDATE anthropometry_assessments SET status='void',void_reason=$4,voided_by=$5,
        voided_at=clock_timestamp(),revision=revision+1 WHERE organization_id=$1 AND student_id=$2 AND id=$3 RETURNING *`,
            [org.id, request.params.studentId, old.id, request.body.reason.trim(), user.id],
          )
        ).rows[0];
        await audit(db, org.id, user.id, 'anthropometry.voided', request.params.studentId, row.id);
        return { assessment: dto(row) };
      });
    },
  );
  app.get<{ Params: Params; Querystring: { from: string; to: string } }>(
    root + '/export.xlsx',
    {
      schema: {
        params,
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['from', 'to'],
          properties: {
            from: { type: 'string', format: 'date' },
            to: { type: 'string', format: 'date' },
          },
        },
      },
    },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId);
      const { from, to } = request.query;
      const span = (Date.parse(to + 'T12:00:00Z') - Date.parse(from + 'T12:00:00Z')) / 86400000;
      if (
        !dateValid(from) ||
        !dateValid(to) ||
        to > today() ||
        !Number.isInteger(span) ||
        span < 0 ||
        span > 366
      )
        throw problem(400, 'INVALID_RANGE', 'Elige un periodo de hasta un año.');
      const bytes = await actorTransaction(pool, user.id, org.id, async (db) => {
        await access(db, org.id, request.params.studentId, org.role === 'owner');
        const rows = (
          await db.query(
            `SELECT * FROM anthropometry_assessments WHERE organization_id=$1 AND student_id=$2
        AND assessed_on BETWEEN $3 AND $4 AND status='final' ORDER BY assessed_on,id LIMIT 201`,
            [org.id, request.params.studentId, from, to],
          )
        ).rows;
        if (rows.length > 200) throw problem(413, 'ANTHROPOMETRY_LIMIT', 'Elige un periodo menor.');
        const assessments = rows.map(dto);
        const sheets: WorkbookSheet[] = [
          {
            name: 'Evaluaciones',
            rows: [
              [
                'Fecha',
                'Protocolo',
                'Estado perfil',
                'Suma 4 (mm)',
                'Suma 8 (mm)',
                'Grasa estimada (%)',
                'Método',
                'Instrumento',
                'Notas',
              ],
              ...assessments.map((a) => [
                a.assessedOn,
                a.protocol,
                a.result?.protocolComplete ? 'Completo' : 'Parcial',
                a.result?.sum4Mm ?? null,
                a.result?.sum8Mm ?? null,
                a.result?.estimate?.bodyFatPercent ?? null,
                a.result?.estimate?.method ?? '',
                a.instrument || a.externalDevice,
                a.notes,
              ]),
            ],
          },
          {
            name: 'Lecturas',
            rows: [
              [
                'Fecha',
                'Sitio',
                'Unidad',
                'Lectura 1',
                'Lectura 2',
                'Lectura 3',
                'Seleccionado',
                'Calidad',
              ],
              ...assessments.flatMap((a) =>
                a.observations.map((o) => [
                  a.assessedOn,
                  o.label,
                  o.unit,
                  o.readings[0] ?? null,
                  o.readings[1] ?? null,
                  o.readings[2] ?? null,
                  a.result?.selected.find((s) => s.site === o.site)?.value ?? null,
                  a.result?.selected.find((s) => s.site === o.site)?.quality ?? '',
                ]),
              ),
            ],
          },
        ];
        await db.query(
          `INSERT INTO audit_logs(organization_id,actor_user_id,action,metadata)
        VALUES($1,$2,'anthropometry.xlsx_exported',jsonb_build_object('studentId',$3::uuid,'from',$4::text,'to',$5::text))`,
          [org.id, user.id, request.params.studentId, from, to],
        );
        return workbook(sheets);
      });
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header(
          'Content-Disposition',
          `attachment; filename="antropometria-${request.params.studentId}.xlsx"`,
        )
        .header('Cache-Control', 'private, no-store')
        .header('X-Content-Type-Options', 'nosniff')
        .send(bytes);
    },
  );
}
