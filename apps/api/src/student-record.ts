import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
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
const uuid = { type: 'string', format: 'uuid' };
const params = {
  type: 'object',
  required: ['organizationId', 'studentId'],
  properties: { organizationId: uuid, studentId: uuid },
};
const querystring = {
  type: 'object',
  additionalProperties: false,
  properties: {
    from: { type: 'string', format: 'date' },
    to: { type: 'string', format: 'date' },
    kind: { type: 'string', enum: ['all', 'training', 'nutrition', 'measurements'] },
  },
};
type Query = {
  from?: string;
  to?: string;
  kind?: 'all' | 'training' | 'nutrition' | 'measurements';
};
const day = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
const isoDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value + 'T12:00:00Z')) &&
  new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
const txt = (value: unknown) => String(value ?? '');

async function loadRecord(
  db: PoolClient,
  org: string,
  student: string,
  q: Query,
  includeSets = false,
) {
  const to = q.to ?? day(new Date());
  const from =
    q.from ?? new Date(Date.parse(to + 'T12:00:00Z') - 89 * 86400000).toISOString().slice(0, 10);
  const span = (Date.parse(to + 'T12:00:00Z') - Date.parse(from + 'T12:00:00Z')) / 86400000;
  if (
    !isoDate(from) ||
    !isoDate(to) ||
    !Number.isInteger(span) ||
    span < 0 ||
    span > 89 ||
    to > day(new Date())
  )
    throw problem(400, 'INVALID_RANGE', 'Elige hasta 90 días, sin fechas futuras.');
  const allowed = (
    await db.query('SELECT app.can_manage_student($1,$2) manage,app.progress_self($2) self', [
      org,
      student,
    ])
  ).rows[0];
  if (!allowed.manage && !allowed.self)
    throw problem(404, 'STUDENT_NOT_FOUND', 'No se encontró el alumno.');
  const studentRow = (
    await db.query('SELECT display_name,status FROM students WHERE organization_id=$1 AND id=$2', [
      org,
      student,
    ])
  ).rows[0];
  if (!studentRow) throw problem(404, 'STUDENT_NOT_FOUND', 'No se encontró el alumno.');
  const kind = q.kind ?? 'all';
  const training = kind === 'all' || kind === 'training';
  const nutrition = kind === 'all' || kind === 'nutrition';
  const measurements = kind === 'all' || kind === 'measurements';
  const programRows = training
    ? (
        await db.query(
          `SELECT a.id,a.starts_on::text "startsOn",a.ends_on::text "endsOn",a.state,v.number,v.snapshot->>'name' name,v.snapshot->>'description' description
           FROM program_assignments a JOIN program_versions v ON v.organization_id=a.organization_id AND v.id=a.version_id
           WHERE a.organization_id=$1 AND a.student_id=$2 AND a.starts_on<=$4 AND a.ends_on>=$3
           ORDER BY a.starts_on DESC,a.id LIMIT 101`,
          [org, student, from, to],
        )
      ).rows
    : [];
  const menuRows = nutrition
    ? (
        await db.query(
          `SELECT a.id,a.starts_on::text "startsOn",a.ends_on::text "endsOn",a.state,v.number,v.snapshot
           FROM nutrition_assignments a JOIN nutrition_versions v ON v.organization_id=a.organization_id AND v.id=a.version_id
           WHERE a.organization_id=$1 AND a.student_id=$2 AND a.starts_on<=$4 AND a.ends_on>=$3
           ORDER BY a.starts_on DESC,a.id LIMIT 101`,
          [org, student, from, to],
        )
      ).rows
    : [];
  const measurementAccess =
    measurements &&
    (await db.query("SELECT app.progress_access($1,'measurements') allowed", [student])).rows[0]
      .allowed;
  const measurementHistoryShared =
    !measurements ||
    allowed.self ||
    (
      await db.query(
        'SELECT EXISTS(SELECT 1 FROM progress_sharing WHERE organization_id=$1 AND student_id=$2 AND professional_user_id=app.actor() AND measurements) shared',
        [org, student],
      )
    ).rows[0].shared;
  const measurementRows = measurementAccess
    ? (
        await db.query(
          `SELECT id,kind,value::float8 value,measured_on::text "measuredOn",source,created_at "createdAt",voided_at "voidedAt",void_reason "voidReason",correction_of "correctionOf"
           FROM body_measurements WHERE organization_id=$1 AND student_id=$2 AND measured_on BETWEEN $3 AND $4
           ORDER BY measured_on DESC,created_at DESC,id DESC LIMIT 501`,
          [org, student, from, to],
        )
      ).rows
    : [];
  const sessionRows = training
    ? (
        await db.query(
          `SELECT id,scheduled_on::text "day",program_name "programName",prescription->>'name' "dayName",duration_seconds "durationSeconds"
           FROM workout_sessions WHERE organization_id=$1 AND student_id=$2 AND state='completed' AND scheduled_on BETWEEN $3 AND $4
           ORDER BY scheduled_on DESC,id DESC LIMIT 201`,
          [org, student, from, to],
        )
      ).rows
    : [];
  if (
    programRows.length > 100 ||
    menuRows.length > 100 ||
    measurementRows.length > 500 ||
    sessionRows.length > 200
  )
    throw problem(413, 'EXPORT_LIMIT', 'Hay demasiados registros. Elige un periodo menor.');
  const sets =
    includeSets && training && sessionRows.length
      ? (
          await db.query(
            `SELECT s.scheduled_on::text "day",s.program_name "programName",e.value#>>'{snapshot,name}' exercise,t.position,t.metric,t.weight_kg::float8 "weightKg",t.reps,t.seconds,t.distance_meters::float8 "distanceMeters"
           FROM workout_sessions s JOIN workout_sets t ON t.organization_id=s.organization_id AND t.session_id=s.id AND t.state='recorded'
           LEFT JOIN LATERAL jsonb_array_elements(s.prescription->'exercises') e ON e.value->>'id'=t.entry_id::text
           WHERE s.organization_id=$1 AND s.student_id=$2 AND s.state='completed' AND s.scheduled_on BETWEEN $3 AND $4
           ORDER BY s.scheduled_on,s.id,t.position LIMIT 3001`,
            [org, student, from, to],
          )
        ).rows
      : [];
  if (sets.length > 3000)
    throw problem(413, 'EXPORT_LIMIT', 'Hay demasiadas series. Elige un periodo menor.');
  return {
    student: { id: student, name: studentRow.display_name, status: studentRow.status },
    from,
    to,
    programs: programRows,
    menus: menuRows,
    measurements: measurementRows,
    sessions: sessionRows,
    sets,
    measurementsPrivate: measurements && (!measurementAccess || !measurementHistoryShared),
  };
}

function sheetsFor(record: Awaited<ReturnType<typeof loadRecord>>): WorkbookSheet[] {
  const sheets: WorkbookSheet[] = [
    {
      name: 'Resumen',
      rows: [
        ['Alumno', record.student.name],
        ['Desde', record.from],
        ['Hasta', record.to],
        ['Zona horaria', 'America/Asuncion'],
        ['Rutinas asignadas', record.programs.length],
        ['Planes de alimentación', record.menus.length],
        ['Mediciones', record.measurements.length],
        ['Sesiones completadas', record.sessions.length],
      ],
    },
  ];
  if (record.programs.length || record.sessions.length || record.sets.length) {
    sheets.push({
      name: 'Rutinas',
      rows: [
        ['Plan', 'Versión', 'Inicio', 'Fin', 'Estado', 'Indicaciones'],
        ...record.programs.map((p) => [
          txt(p.name),
          Number(p.number),
          txt(p.startsOn),
          txt(p.endsOn),
          txt(p.state),
          txt(p.description),
        ]),
      ],
    });
    sheets.push({
      name: 'Sesiones',
      rows: [
        ['Fecha', 'Programa', 'Día', 'Duración (s)'],
        ...record.sessions.map((s) => [
          txt(s.day),
          txt(s.programName),
          txt(s.dayName),
          s.durationSeconds === null ? null : Number(s.durationSeconds),
        ]),
      ],
    });
    sheets.push({
      name: 'Series',
      rows: [
        [
          'Fecha',
          'Programa',
          'Ejercicio',
          'Serie',
          'Tipo',
          'Peso (kg)',
          'Repeticiones',
          'Tiempo (s)',
          'Distancia (m)',
        ],
        ...record.sets.map((s) => [
          txt(s.day),
          txt(s.programName),
          txt(s.exercise),
          Number(s.position),
          txt(s.metric),
          s.weightKg === null ? null : Number(s.weightKg),
          s.reps === null ? null : Number(s.reps),
          s.seconds === null ? null : Number(s.seconds),
          s.distanceMeters === null ? null : Number(s.distanceMeters),
        ]),
      ],
    });
  }
  if (record.menus.length) {
    sheets.push({
      name: 'Alimentación',
      rows: [
        ['Plan', 'Versión', 'Inicio', 'Fin', 'Estado', 'Indicaciones'],
        ...record.menus.map((m) => [
          txt(m.snapshot?.name),
          Number(m.number),
          txt(m.startsOn),
          txt(m.endsOn),
          txt(m.state),
          txt(m.snapshot?.description),
        ]),
      ],
    });
    sheets.push({
      name: 'Comidas',
      rows: [
        ['Plan', 'Día semanal', 'Indicaciones del día', 'Momento', 'Receta', 'Porciones', 'Notas'],
        ...record.menus.flatMap((m) =>
          (m.snapshot?.days ?? []).flatMap(
            (d: {
              weekday: number;
              notes?: string;
              meals: {
                label: string;
                recipe?: { name: string };
                servings: number;
                notes: string;
              }[];
            }) =>
              d.meals.length
                ? d.meals.map((meal) => [
                    txt(m.snapshot?.name),
                    Number(d.weekday),
                    txt(d.notes),
                    txt(meal.label),
                    txt(meal.recipe?.name),
                    Number(meal.servings),
                    txt(meal.notes),
                  ])
                : [[txt(m.snapshot?.name), Number(d.weekday), txt(d.notes), '', '', null, '']],
          ),
        ),
      ],
    });
  }
  if (record.measurements.length)
    sheets.push({
      name: 'Mediciones',
      rows: [
        [
          'Fecha medida',
          'Tipo',
          'Valor',
          'Unidad',
          'Origen',
          'Cargado',
          'Estado',
          'Motivo',
          'Corrige registro',
        ],
        ...record.measurements.map((m) => [
          txt(m.measuredOn),
          txt(m.kind),
          Number(m.value),
          m.kind === 'weight' ? 'kg' : 'cm',
          txt(m.source),
          new Date(m.createdAt).toISOString(),
          m.voidedAt ? 'Anulado' : 'Vigente',
          txt(m.voidReason),
          txt(m.correctionOf),
        ]),
      ],
    });
  return sheets;
}

export async function registerStudentRecord(app: FastifyInstance, { pool, context }: Options) {
  const root = '/v1/organizations/:organizationId/students/:studentId';
  type Req = { Params: { organizationId: string; studentId: string }; Querystring: Query };
  app.get<Req>(root + '/record', { schema: { params, querystring } }, async (request) => {
    const { user, org } = await context(request, request.params.organizationId);
    return actorTransaction(pool, user.id, org.id, async (db) => {
      const record = await loadRecord(db, org.id, request.params.studentId, request.query);
      const latest = Object.values(
        record.measurements.reduce<Record<string, (typeof record.measurements)[number]>>(
          (map, row) => {
            if (!row.voidedAt && !map[row.kind]) map[row.kind] = row;
            return map;
          },
          {},
        ),
      );
      return { ...record, latestMeasurements: latest, sets: undefined };
    });
  });
  app.get<Req>(
    root + '/export.xlsx',
    { schema: { params, querystring } },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId);
      const bytes = await actorTransaction(pool, user.id, org.id, async (db) => {
        const record = await loadRecord(db, org.id, request.params.studentId, request.query, true);
        await db.query(
          "INSERT INTO audit_logs(organization_id,actor_user_id,action,metadata)VALUES($1,$2,'student.xlsx_exported',jsonb_build_object('studentId',$3::uuid,'from',$4::text,'to',$5::text))",
          [org.id, user.id, request.params.studentId, record.from, record.to],
        );
        return workbook(sheetsFor(record));
      });
      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header(
          'Content-Disposition',
          `attachment; filename="alumno-${request.params.studentId}.xlsx"`,
        )
        .header('Cache-Control', 'private, no-store')
        .header('X-Content-Type-Options', 'nosniff')
        .send(bytes);
    },
  );
}
