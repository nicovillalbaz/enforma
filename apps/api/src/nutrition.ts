import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import type {
  CurrentUser,
  OrganizationSummary,
  MealEntry,
  NutritionState,
  FoodDocument,
} from '@forma/shared';
import type { AppConfig } from './app.js';
import { actorTransaction } from './organizations.js';
import { problem } from './problems.js';
import { PrivateStorage } from './storage.js';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
interface Options {
  pool: Pool;
  config: AppConfig;
  context: (
    request: FastifyRequest,
    id: string,
    roles?: string[],
  ) => Promise<{ user: CurrentUser; org: OrganizationSummary }>;
}
const uuid = { type: 'string', format: 'uuid' },
  nullableUuid = { anyOf: [uuid, { type: 'null' }] },
  date = { type: 'string', format: 'date' },
  boolean = { type: 'boolean' },
  revision = { type: 'integer', minimum: 0 },
  text = (max: number, min = 0) => ({ type: 'string', minLength: min, maxLength: max }),
  number = (max: number, min = 0) => ({ type: 'number', minimum: min, maximum: max }),
  object = (properties: Record<string, unknown>) => ({
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  }),
  array = (items: unknown, max: number, min = 0) => ({
    type: 'array',
    items,
    maxItems: max,
    minItems: min,
  }),
  params = object({ organizationId: uuid }),
  itemParams = object({ organizationId: uuid, id: uuid }),
  food = object({
    name: text(100, 2),
    source: text(200, 2),
    reference: text(500, 1),
    license: text(200, 2),
    checkedOn: date,
    nutrients: object(
      Object.fromEntries(
        ['kcal', 'protein', 'carbs', 'fat'].map((k) => [
          k,
          { ...number(k === 'kcal' ? 2000 : 100), type: ['number', 'null'] },
        ]),
      ),
    ),
    allergensKnown: boolean,
    allergens: array(text(100, 1), 20),
  }),
  recipe = object({
    name: text(100, 2),
    instructions: text(10000),
    servings: number(1000, 0.01),
    ingredients: array(object({ foodId: uuid, grams: number(100000, 0.01) }), 30, 1),
  }),
  menu = object({
    name: text(100, 2),
    description: text(3000),
    days: array(
      {
        type: 'object',
        additionalProperties: false,
        required: ['weekday', 'meals'],
        properties: {
          weekday: { type: 'integer', minimum: 1, maximum: 7 },
          notes: text(3000),
          meals: array(
            object({
              id: uuid,
              label: text(80, 1),
              recipeId: uuid,
              alternativeRecipeId: nullableUuid,
              servings: number(100, 0.01),
              notes: text(2000),
            }),
            6,
            0,
          ),
        },
      },
      7,
      7,
    ),
  });
type P = { organizationId: string; id: string };
type ItemBody = {
  kind: 'food' | 'recipe' | 'menu';
  revision: number;
  archived: boolean;
  document: unknown;
};
export async function registerNutrition(app: FastifyInstance, { pool, config, context }: Options) {
  const root = '/v1/organizations/:organizationId/nutrition',
    storage = new PrivateStorage(
      config.storageRoot ?? process.env.STORAGE_PATH ?? '.local/storage',
      2097152,
    );
  let activePhoto = false;
  async function run<T>(
    request: FastifyRequest,
    id: string,
    fn: (db: PoolClient) => Promise<T>,
    roles?: string[],
  ) {
    const { user, org } = await context(request, id, roles);
    return actorTransaction(pool, user.id, org.id, fn);
  }
  app.get<{ Params: P; Querystring: { studentId?: string; from: string; to: string; q?: string } }>(
    root,
    {
      schema: {
        params,
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['from', 'to'],
          properties: { studentId: uuid, from: date, to: date, q: text(100) },
        },
      },
    },
    async (request) =>
      run(request, request.params.organizationId, async (db) => {
        const q = request.query,
          days = (Date.parse(q.to) - Date.parse(q.from)) / 86400000;
        if (
          !Number.isInteger(days) ||
          days < 0 ||
          days > 89 ||
          q.from < '2000-01-01' ||
          q.to > '2100-01-01'
        )
          throw problem(400, 'INVALID_NUTRITION', 'Selecciona un periodo de hasta 90 días.');
        const professional = !!(await db.query('SELECT app.nutrition_professional() allowed'))
          .rows[0].allowed;
        const own =
          (
            await db.query(
              "SELECT id FROM students WHERE organization_id=app.tenant() AND user_id=app.actor() AND status='active'",
            )
          ).rows[0]?.id ?? null;
        const student = q.studentId ?? own;
        if (
          student &&
          !(await db.query("SELECT app.nutrition_access($1,'menu') allowed", [student])).rows[0]
            .allowed
        )
          throw problem(403, 'FORBIDDEN', 'No puedes consultar este menú.');
        const items = professional
          ? (
              await db.query(
                'SELECT id,kind,document,revision,archived FROM nutrition_items WHERE organization_id=app.tenant() ORDER BY updated_at DESC,id',
              )
            ).rows
          : [];
        const students = professional
          ? (
              await db.query(
                "SELECT id,display_name AS \"displayName\" FROM students WHERE organization_id=app.tenant() AND status='active' AND app.nutrition_manage(id) AND (($1='' OR display_name ILIKE '%'||$1||'%') OR id=$2::uuid) ORDER BY (id=$2::uuid) DESC,display_name,id LIMIT 100",
                [q.q ?? '', student],
              )
            ).rows
          : [];
        const assignments = student
          ? (
              await db.query(
                `SELECT a.id,a.student_id "studentId",s.display_name "studentName",a.version_id "versionId",v.number,v.snapshot,a.starts_on::text "startsOn",a.ends_on::text "endsOn",a.state,a.revision FROM nutrition_assignments a JOIN nutrition_versions v ON v.organization_id=a.organization_id AND v.id=a.version_id JOIN students s ON s.organization_id=a.organization_id AND s.id=a.student_id WHERE a.organization_id=app.tenant() AND a.student_id=$1 AND a.starts_on<=$3 AND a.ends_on>=$2 ORDER BY (a.state='active') DESC,a.starts_on DESC,a.id LIMIT 91`,
                [student, q.from, q.to],
              )
            ).rows
          : [];
        const access = student
          ? (
              await db.query(
                "SELECT app.nutrition_access($1,'diary') diary,app.nutrition_access($1,'photos') photos",
                [student],
              )
            ).rows[0]
          : { diary: false, photos: false };
        const rows =
          student && access.diary
            ? (
                await db.query(
                  `SELECT e.id,e.assignment_id "assignmentId",e.eaten_on::text "eatenOn",e.meal_id "mealId",e.state,e.choice,e.portions::float8 portions,e.note,e.revision FROM nutrition_entries e WHERE e.organization_id=app.tenant() AND e.student_id=$1 AND e.eaten_on BETWEEN $2 AND $3 ORDER BY e.eaten_on,e.id LIMIT 541`,
                  [student, q.from, q.to],
                )
              ).rows
            : [];
        const ids = rows.map((e) => e.id);
        const comments = ids.length
          ? (
              await db.query(
                `SELECT id,entry_id,message,created_at "createdAt" FROM nutrition_comments WHERE entry_id=ANY($1::uuid[]) ORDER BY created_at,id`,
                [ids],
              )
            ).rows
          : [];
        const photos =
          ids.length && access.photos
            ? (
                await db.query(
                  'SELECT id,entry_id FROM nutrition_photos WHERE entry_id=ANY($1::uuid[]) ORDER BY created_at',
                  [ids],
                )
              ).rows
            : [];
        const entries = rows.slice(0, 540).map((e) => ({
          ...e,
          comments: comments
            .filter((c) => c.entry_id === e.id)
            .map((c) => ({
              id: c.id,
              message: c.message,
              authorName: 'Coach',
              createdAt: c.createdAt.toISOString(),
            })),
          photos: photos
            .filter((p) => p.entry_id === e.id)
            .map((p) => ({
              id: p.id,
              url: `${root.replace(':organizationId', request.params.organizationId)}/photos/${p.id}/file`,
              thumbnailUrl: `${root.replace(':organizationId', request.params.organizationId)}/photos/${p.id}/file?thumbnail=1`,
            })),
        })) as MealEntry[];
        const preferences =
          student && student === own
            ? ((
                await db.query(
                  'SELECT revision,diary_consent "diaryConsent",photo_consent "photoConsent",consent_version "consentVersion" FROM nutrition_preferences WHERE organization_id=app.tenant() AND student_id=$1',
                  [student],
                )
              ).rows[0] ?? {
                revision: 0,
                diaryConsent: false,
                photoConsent: false,
                consentVersion: null,
              })
            : null;
        const professionals: [] = [];
        return {
          professional,
          selfStudentId: own,
          canReadDiary: !!access.diary,
          canReadPhotos: !!access.photos,
          foods: items.filter((i) => i.kind === 'food'),
          recipes: items.filter((i) => i.kind === 'recipe'),
          menus: items.filter((i) => i.kind === 'menu'),
          assignments: assignments.slice(0, 90),
          assignmentsTruncated: assignments.length > 90,
          entriesTruncated: rows.length > 540,
          entries,
          privacy: preferences ? { ...preferences, professionals } : null,
          students,
        } satisfies NutritionState;
      }),
  );
  app.get<{ Params: P }>(root + '/professionals', { schema: { params } }, async (request) =>
    run(request, request.params.organizationId, async (db) => ({
      professionals: (await db.query('SELECT app.nutrition_people(NULL) data')).rows[0].data,
    })),
  );
  app.put<{ Params: P; Body: { enabled: boolean; qualification: string; revision: number } }>(
    root + '/professionals/:id',
    {
      schema: {
        params: itemParams,
        body: object({ enabled: boolean, qualification: text(200, 3), revision }),
      },
    },
    async (request) =>
      run(
        request,
        request.params.organizationId,
        async (db) => {
          const b = request.body;
          await db.query('SELECT app.set_nutrition_professional($1,$2,$3,$4)', [
            request.params.id,
            b.enabled,
            b.qualification,
            b.revision,
          ]);
          return { ok: true };
        },
        ['owner'],
      ),
  );
  app.put<{ Params: P; Body: ItemBody }>(
    root + '/items/:id',
    {
      bodyLimit: 60000,
      schema: {
        params: itemParams,
        body: {
          oneOf: [
            ['food', food],
            ['recipe', recipe],
            ['menu', menu],
          ].map(([kind, document]) =>
            object({ kind: { const: kind }, document, revision, archived: boolean }),
          ),
        },
      },
    },
    async (request) =>
      run(
        request,
        request.params.organizationId,
        async (db) => {
          const b = request.body;
          if (b.kind === 'food') {
            const foodDocument = b.document as FoodDocument;
            const hasClaims =
              foodDocument.allergensKnown ||
              Object.values(foodDocument.nutrients).some((value) => value !== null);
            if (
              hasClaims &&
              (foodDocument.source === 'Catálogo Forma: solo nombres' ||
                foodDocument.reference ===
                  'Sin valores nutricionales; completar con fuente verificada' ||
                foodDocument.license === 'Nombres comunes; sin datos de terceros')
            )
              throw problem(
                400,
                'FOOD_SOURCE_REQUIRED',
                'Indica una fuente verificable para los valores o alérgenos.',
              );
          }
          await db.query('SELECT app.save_nutrition_item($1,$2,$3,$4,$5)', [
            request.params.id,
            b.kind,
            b.revision,
            b.document,
            b.archived,
          ]);
          return { ok: true };
        },
        ['owner', 'coach'],
      ),
  );
  app.post<{ Params: P; Body: { revision: number } }>(
    root + '/menus/:id/publish',
    { schema: { params: itemParams, body: object({ revision }) } },
    async (request) =>
      run(
        request,
        request.params.organizationId,
        async (db) => ({
          versionId: (
            await db.query('SELECT app.publish_nutrition_menu($1,$2) id', [
              request.params.id,
              request.body.revision,
            ])
          ).rows[0].id,
        }),
        ['owner', 'coach'],
      ),
  );
  app.get<{ Params: P }>(
    root + '/menus/:id/versions',
    { schema: { params: itemParams } },
    async (request) =>
      run(
        request,
        request.params.organizationId,
        async (db) => ({
          versions: (
            await db.query(
              'SELECT id,number,source_revision "sourceRevision",snapshot FROM nutrition_versions WHERE menu_id=$1 ORDER BY number DESC',
              [request.params.id],
            )
          ).rows,
        }),
        ['owner', 'coach'],
      ),
  );
  app.put<{
    Params: P;
    Body: { versionId: string; studentId: string; startsOn: string; endsOn: string };
  }>(
    root + '/assignments/:id',
    {
      schema: {
        params: itemParams,
        body: object({ versionId: uuid, studentId: uuid, startsOn: date, endsOn: date }),
      },
    },
    async (request) =>
      run(
        request,
        request.params.organizationId,
        async (db) => {
          const b = request.body;
          await db.query('SELECT app.assign_nutrition_menu($1,$2,$3,$4,$5)', [
            request.params.id,
            b.versionId,
            b.studentId,
            b.startsOn,
            b.endsOn,
          ]);
          return { ok: true };
        },
        ['owner', 'coach'],
      ),
  );
  app.post<{ Params: P; Body: { revision: number; reason: string } }>(
    root + '/assignments/:id/cancel',
    { schema: { params: itemParams, body: object({ revision, reason: text(200, 3) }) } },
    async (request) =>
      run(
        request,
        request.params.organizationId,
        async (db) => {
          await db.query('SELECT app.cancel_nutrition_assignment($1,$2,$3)', [
            request.params.id,
            request.body.revision,
            request.body.reason,
          ]);
          return { ok: true };
        },
        ['owner', 'coach'],
      ),
  );
  app.put<{
    Params: P;
    Body: {
      revision: number;
      diaryConsent: boolean;
      photoConsent: boolean;
      professionals: { id: string; diary: boolean; photos: boolean }[];
    };
  }>(
    root + '/privacy/:id',
    {
      schema: {
        params: itemParams,
        body: object({
          revision,
          diaryConsent: boolean,
          photoConsent: boolean,
          professionals: array(object({ id: uuid, diary: boolean, photos: boolean }), 50),
        }),
      },
    },
    async (request) =>
      run(
        request,
        request.params.organizationId,
        async (db) => {
          const b = request.body;
          await db.query('SELECT app.set_nutrition_privacy($1,$2,$3,$4,$5)', [
            request.params.id,
            b.revision,
            b.diaryConsent,
            b.photoConsent,
            JSON.stringify(b.professionals),
          ]);
          return { ok: true };
        },
        ['student'],
      ),
  );
  app.post<{
    Params: P;
    Body: {
      assignmentId: string;
      eatenOn: string;
      mealId: string;
      requestId: string;
      revision: number;
      state: string;
      choice: string;
      portions: number | null;
      note: string;
    };
  }>(
    root + '/entries',
    {
      schema: {
        params,
        body: object({
          assignmentId: uuid,
          eatenOn: date,
          mealId: uuid,
          requestId: uuid,
          revision,
          state: { enum: ['eaten', 'skipped'] },
          choice: { enum: ['main', 'alternative', 'other'] },
          portions: { ...number(100, 0.01), type: ['number', 'null'] },
          note: text(1000),
        }),
      },
    },
    async (request) =>
      run(
        request,
        request.params.organizationId,
        async (db) => {
          const b = request.body;
          return {
            id: (
              await db.query('SELECT app.save_nutrition_entry($1,$2,$3,$4,$5,$6,$7,$8,$9) id', [
                b.assignmentId,
                b.eatenOn,
                b.mealId,
                b.requestId,
                b.revision,
                b.state,
                b.choice,
                b.portions,
                b.note,
              ])
            ).rows[0].id,
          };
        },
        ['student'],
      ),
  );
  app.post<{ Params: P; Body: { requestId: string; message: string } }>(
    root + '/entries/:id/comments',
    { schema: { params: itemParams, body: object({ requestId: uuid, message: text(1000, 1) }) } },
    async (request) =>
      run(
        request,
        request.params.organizationId,
        async (db) => ({
          id: (
            await db.query('SELECT app.add_nutrition_comment($1,$2,$3) id', [
              request.params.id,
              request.body.requestId,
              request.body.message,
            ])
          ).rows[0].id,
        }),
        ['owner', 'coach'],
      ),
  );
  app.post<{ Params: P; Body: { requestId: string; dataUrl: string } }>(
    root + '/entries/:id/photos',
    {
      bodyLimit: 2900000,
      onRequest: async (request) => {
        await context(request, (request.params as P).organizationId, ['student']);
      },
      schema: { params: itemParams, body: object({ requestId: uuid, dataUrl: text(2800000, 1) }) },
    },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId, ['student']);
      await actorTransaction(pool, user.id, org.id, async (db) => {
        if (
          !(
            await db.query(
              'SELECT app.progress_self(e.student_id) AND EXISTS(SELECT 1 FROM nutrition_preferences p WHERE p.organization_id=e.organization_id AND p.student_id=e.student_id AND p.diary_consent AND p.photo_consent) allowed FROM nutrition_entries e WHERE e.id=$1',
              [request.params.id],
            )
          ).rows[0]?.allowed
        )
          throw problem(
            403,
            'NUTRITION_CONSENT',
            'Activa las fotos en tus permisos de alimentación.',
          );
      });
      if (activePhoto) throw problem(429, 'PHOTO_BUSY', 'Espera a que termine la foto anterior.');
      activePhoto = true;
      const keys: string[] = [];
      let retained = false;
      try {
        const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
          request.body.dataUrl,
        );
        if (!match) throw problem(400, 'INVALID_PHOTO', 'Usa PNG, JPEG o WebP.');
        const input = Buffer.from(match[2]!, 'base64');
        if (!input.length || input.length > 2097152)
          throw problem(413, 'INVALID_PHOTO', 'La foto supera 2 MiB.');
        let full: Buffer, thumb: Buffer, width: number, height: number;
        try {
          const metadata = await sharp(input, {
            limitInputPixels: 8388608,
            animated: false,
          }).metadata();
          if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1)
            throw Error('format');
          const result = await sharp(input, { limitInputPixels: 8388608, animated: false })
            .timeout({ seconds: 5 })
            .rotate()
            .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82 })
            .toBuffer({ resolveWithObject: true });
          full = result.data;
          width = result.info.width;
          height = result.info.height;
          thumb = await sharp(full)
            .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 75 })
            .toBuffer();
          if (full.length + thumb.length > 2097152) throw Error('size');
        } catch {
          throw problem(
            400,
            'INVALID_PHOTO',
            'No se pudo leer la imagen. Máximo 8 megapíxeles, sin animación.',
          );
        }
        const result = await actorTransaction(pool, user.id, org.id, async (db) => {
          await db.query('SELECT pg_advisory_xact_lock_shared(70321021)');
          keys.push(await storage.put(full, 'webp'), await storage.put(thumb, 'webp'));
          const id = (
            await db.query('SELECT app.save_nutrition_photo($1,$2,$3,$4,$5,$6,$7,$8) id', [
              request.params.id,
              request.body.requestId,
              createHash('sha256').update(input).digest('hex'),
              keys[0],
              keys[1],
              full.length + thumb.length,
              width,
              height,
            ])
          ).rows[0].id;
          const r = (await db.query('SELECT storage_key FROM nutrition_photos WHERE id=$1', [id]))
            .rows[0];
          return { id, key: r?.storage_key };
        });
        retained = result.key === keys[0];
        reply.code(201);
        return { id: result.id };
      } finally {
        activePhoto = false;
        if (!retained) for (const key of keys) await storage.remove(key).catch(() => {});
      }
    },
  );
  app.delete<{ Params: P }>(
    root + '/photos/:id',
    { schema: { params: itemParams } },
    async (request) =>
      run(
        request,
        request.params.organizationId,
        async (db) => {
          await db.query('SELECT app.delete_nutrition_photo($1)', [request.params.id]);
          return { ok: true };
        },
        ['student'],
      ),
  );
  app.get<{ Params: P; Querystring: { thumbnail?: string } }>(
    root + '/photos/:id/file',
    {
      schema: {
        params: itemParams,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { thumbnail: { const: '1' } },
        },
      },
    },
    async (request, reply) => {
      const row = await run(
        request,
        request.params.organizationId,
        async (db) =>
          (await db.query('SELECT app.nutrition_photo_file($1) data', [request.params.id])).rows[0]
            ?.data,
      );
      if (!row) throw problem(404, 'NUTRITION_NOT_FOUND', 'La foto no está disponible.');
      let bytes: Buffer;
      try {
        bytes = await storage.read(request.query.thumbnail ? row.thumbnail_key : row.storage_key);
      } catch {
        throw problem(404, 'NUTRITION_NOT_FOUND', 'La foto no está disponible.');
      }
      return reply
        .header('Cache-Control', 'private, no-store')
        .header('X-Content-Type-Options', 'nosniff')
        .header('Content-Type', 'image/webp')
        .header('Content-Disposition', 'inline; filename="comida.webp"')
        .send(bytes);
    },
  );
}
