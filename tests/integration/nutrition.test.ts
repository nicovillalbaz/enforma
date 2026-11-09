import { approveFixtureCoach } from '../helpers/coach-approval.js';
import 'dotenv/config';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { buildApp } from '../../apps/api/src/app.js';
import { actorTransaction } from '../../apps/api/src/organizations.js';
import { isolatedDatabase } from '../helpers/database.js';
import { claimDocumentJob, processDocumentJob } from '../../apps/worker/src/documents.js';
import {
  recipeNutrients,
  actualNutrients,
  nutritionWeekday,
  type RecipeSnapshot,
} from '@forma/shared';
const fixture = isolatedDatabase(),
  admin = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_ADMIN_URL), max: 3 }),
  api = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_URL), max: 3 }),
  worker = new pg.Pool({ connectionString: fixture.url(process.env.WORKER_DATABASE_URL), max: 3 });
let server: Awaited<ReturnType<typeof buildApp>>,
  directory: string,
  ip = 1;
function client() {
  let cookie = '',
    csrf = '';
  const address = `127.0.3.${ip++}`;
  return {
    get cookies() {
      return cookie;
    },
    async call(
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      url: string,
      body?: unknown,
      headers: Record<string, string> = {},
    ) {
      if (!csrf) {
        const r = await server.inject({ url: '/v1/security/csrf', remoteAddress: address });
        csrf = r.json().token;
        cookie = String(r.headers['set-cookie']).split(';')[0]!;
      }
      const r = await server.inject({
        method,
        url,
        remoteAddress: address,
        headers: { cookie, 'x-csrf-token': csrf, ...headers },
        ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
      });
      const set = r.headers['set-cookie'];
      for (const v of set ? (Array.isArray(set) ? set : [set]) : []) {
        const pair = v.split(';')[0]!,
          name = pair.split('=')[0]!;
        cookie = cookie
          .split('; ')
          .filter((x) => !x.startsWith(name + '='))
          .concat(pair)
          .join('; ');
      }
      return r;
    },
  };
}
async function coach(label: string) {
  const http = client(),
    suffix = randomUUID().slice(0, 8);
  const r = await http.call('POST', '/v1/auth/register-coach', {
    fullName: 'Coach Rutinas',
    email: `${label}-${suffix}@example.test`,
    password: 'Programs-password-2026!',
    name: 'Programas ' + label,
    slug: `program-${label}-${suffix}`,
    kind: 'coach',
    accent: '#005ea8',
    plan: 'basic',
    privacyAccepted: true,
  });
  expect(r.statusCode, r.body).toBe(201);
  await approveFixtureCoach(admin, r.json().organizationId);
  const userId = (await http.call('GET', '/v1/auth/me')).json().user.id;
  await admin.query('UPDATE app_users SET email_verified_at=now() WHERE id=$1', [userId]);
  return { http, id: r.json().organizationId as string, userId };
}
type Coach = Awaited<ReturnType<typeof coach>>;
async function pupil(owner: Coach, label: string) {
  const email = `${label.replaceAll(' ', '-')}-${randomUUID().slice(0, 8)}@example.test`;
  const created = await owner.http.call('POST', `/v1/organizations/${owner.id}/students`, {
    displayName: label,
    email,
    goal: 'Fuerza',
  });
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json().student.id as string;
  const invitation = (
    await owner.http.call('POST', `/v1/organizations/${owner.id}/students/${id}/invitation`)
  ).json().url;
  const http = client();
  const r = await http.call('POST', '/v1/invitations/accept', {
    token: new URL(invitation).searchParams.get('token'),
    fullName: label,
    goal: 'Fuerza',
    password: 'Student-programs-2026!',
    privacyAccepted: true,
  });
  expect(r.statusCode, r.body).toBe(200);
  return { id, http, userId: (await http.call('GET', '/v1/auth/me')).json().user.id };
}

let a: Coach,
  b: Coach,
  s1: Awaited<ReturnType<typeof pupil>>,
  s2: Awaited<ReturnType<typeof pupil>>,
  root: string,
  today: string,
  from: string,
  to: string,
  foodId: string,
  unknownId: string,
  recipeId: string,
  alternativeId: string,
  menuId: string,
  versionId: string,
  assignmentId: string,
  mealId: string,
  foreignId: string;
let initialAllowed = 0;
const day = (value: string, offset: number) =>
  new Date(Date.parse(value + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
const foodDoc = (name: string, unknown = false) => ({
  name,
  source: 'Fuente sintética T09',
  reference: 'FIXTURE-NO-REAL',
  license: 'fixture interno',
  checkedOn: today,
  nutrients: {
    kcal: unknown ? null : 200,
    protein: unknown ? null : 0,
    carbs: unknown ? null : 25,
    fat: unknown ? null : 10,
  },
  allergensKnown: !unknown,
  allergens: [],
});
const recipeDoc = (name: string, id: string) => ({
  name,
  instructions: 'Preparar y servir. Ficticio, no es recomendación.',
  servings: 2,
  ingredients: [{ foodId: id, grams: 150 }],
});
const menuDoc = () => ({
  name: 'Semana Ñandutí · QA',
  description: 'Menú ficticio de siete días',
  days: Array.from({ length: 7 }, (_, i) => ({
    weekday: i + 1,
    meals: [
      {
        id: randomUUID(),
        label: 'Almuerzo',
        recipeId,
        alternativeRecipeId: alternativeId,
        servings: 1,
        notes: 'Sin objetivos clínicos.',
      },
    ],
  })),
});
async function check(r: Awaited<ReturnType<ReturnType<typeof client>['call']>>, status = 200) {
  expect(r.statusCode, r.body).toBe(status);
  return r.json();
}
const state = async (http = s1.http, student?: string) =>
  check(
    await http.call(
      'GET',
      root + `/nutrition?from=${from}&to=${to}` + (student ? '&studentId=' + student : ''),
    ),
  );
async function privacy(
  grants: { id: string; diary: boolean; photos: boolean }[],
  photos = false,
  diary = true,
  http = s1.http,
  student = s1.id,
) {
  const current = (await state(http)).privacy;
  return check(
    await http.call('PUT', root + '/nutrition/privacy/' + student, {
      revision: current.revision,
      diaryConsent: diary,
      photoConsent: photos,
      professionals: grants,
    }),
  );
}
async function entry() {
  await privacy([]);
  const st = await state(),
    old = st.entries.find((e: { mealId: string }) => e.mealId === mealId);
  return check(
    await s1.http.call('POST', root + '/nutrition/entries', {
      assignmentId,
      eatenOn: today,
      mealId,
      requestId: randomUUID(),
      revision: old?.revision ?? 0,
      state: 'eaten',
      choice: 'main',
      portions: null,
      note: 'Nota privada de comida',
    }),
  );
}
beforeAll(async () => {
  directory = await fixture.create();
  server = await buildApp({
    origin: 'http://127.0.0.1:5173',
    cookieSecret: 'nutrition-tests-secret-at-least-32-characters',
    databaseUrl: fixture.url(process.env.DATABASE_URL),
    storageRoot: directory,
    developmentMailbox: true,
  });
  server.addHook('onError', (_req, _reply, e, done) => {
    if (['42702', '42501', '42883', '42P01', '42P17'].includes(e.code ?? ''))
      console.error({ code: e.code, message: e.message });
    done();
  });
  a = await coach('nutrition');
  b = await coach('foreign');
  s1 = await pupil(a, 'Alumna Comidas');
  s2 = await pupil(a, 'Otra Alumna');
  root = `/v1/organizations/${a.id}`;
  today = (
    await admin.query("SELECT (now() AT TIME ZONE 'America/Asuncion')::date::text AS day_date")
  ).rows[0].day_date;
  from = day(today, -6);
  to = day(today, 6);
  foodId = randomUUID();
  unknownId = randomUUID();
  recipeId = randomUUID();
  alternativeId = randomUUID();
  menuId = randomUUID();
  assignmentId = randomUUID();
  foreignId = randomUUID();
  initialAllowed = (
    await a.http.call('PUT', root + '/nutrition/items/' + foodId, {
      kind: 'food',
      revision: 0,
      archived: false,
      document: foodDoc('Alimento conocido'),
    })
  ).statusCode;
  await check(
    await b.http.call('PUT', `/v1/organizations/${b.id}/nutrition/items/${foreignId}`, {
      kind: 'food',
      revision: 0,
      archived: false,
      document: foodDoc('Alimento de otro tenant'),
    }),
  );
  for (const [id, document] of [[unknownId, foodDoc('Alimento sin datos', true)]] as const)
    await check(
      await a.http.call('PUT', root + '/nutrition/items/' + id, {
        kind: 'food',
        revision: 0,
        archived: false,
        document,
      }),
    );
  for (const [id, document] of [
    [recipeId, recipeDoc('Receta principal', foodId)],
    [alternativeId, recipeDoc('Receta alternativa', unknownId)],
  ] as const)
    await check(
      await a.http.call('PUT', root + '/nutrition/items/' + id, {
        kind: 'recipe',
        revision: 0,
        archived: false,
        document,
      }),
    );
  const document = menuDoc();
  mealId = document.days[nutritionWeekday(today) - 1]!.meals[0]!.id;
  await check(
    await a.http.call('PUT', root + '/nutrition/items/' + menuId, {
      kind: 'menu',
      revision: 0,
      archived: false,
      document,
    }),
  );
  versionId = (
    await check(
      await a.http.call('POST', root + '/nutrition/menus/' + menuId + '/publish', { revision: 1 }),
    )
  ).versionId;
  await check(
    await a.http.call('PUT', root + '/nutrition/assignments/' + assignmentId, {
      versionId,
      studentId: s1.id,
      startsOn: from,
      endsOn: to,
    }),
  );
});
afterAll(async () => {
  await server?.close();
  await api.end();
  await worker.end();
  await admin.end();
  await fixture.drop();
});
it('preloads separate editable food names for each newly created coach', async () => {
  const seeded = await admin.query<{ organization_id: string; names: number; unknown: number }>(
    `SELECT organization_id,count(*)::integer names,
      count(*) FILTER (WHERE document->'nutrients'->>'kcal' IS NULL)::integer unknown
     FROM nutrition_items
     WHERE organization_id=ANY($1::uuid[]) AND kind='food'
       AND document->>'source'='Catálogo Forma: solo nombres'
     GROUP BY organization_id`,
    [[a.id, b.id]],
  );
  expect(seeded.rows).toHaveLength(2);
  for (const row of seeded.rows) {
    expect(row.names).toBe(80);
    expect(row.unknown).toBe(80);
  }
});
it('el coach independiente escribe su plan; otro tenant y otro alumno no heredan acceso', async () => {
  expect(initialAllowed).toBe(200);
  await check(
    await b.http.call('GET', root + `/nutrition?from=${from}&to=${to}&studentId=${s1.id}`),
    404,
  );
  await check(
    await s2.http.call('GET', root + `/nutrition?from=${from}&to=${to}&studentId=${s1.id}`),
    403,
  );
  const own = await state();
  expect(own.assignments[0].snapshot.name).toContain('Ñandutí');
  expect(own.foods).toEqual([]);
  const foreign = await check(
    await b.http.call('GET', `/v1/organizations/${b.id}/nutrition?from=${from}&to=${to}`),
  );
  expect(foreign.professional).toBe(true);
  expect(foreign.students).toEqual([]);
});
it('valida fuente, rendimiento y referencias; SQL directo no escribe ni sobrescribe otro tenant', async () => {
  await check(
    await a.http.call('PUT', root + '/nutrition/items/' + randomUUID(), {
      kind: 'recipe',
      revision: 0,
      archived: false,
      document: { ...recipeDoc('Inválida', foodId), servings: 0 },
    }),
    400,
  );
  await check(
    await a.http.call('PUT', root + '/nutrition/items/' + randomUUID(), {
      kind: 'food',
      revision: 0,
      archived: false,
      document: { ...foodDoc('Inválido'), source: '' },
    }),
    400,
  );
  await check(
    await a.http.call('PUT', root + '/nutrition/items/' + foreignId, {
      kind: 'food',
      revision: 0,
      archived: false,
      document: foodDoc('Intento cruzado'),
    }),
    403,
  );
  expect(
    (
      await admin.query("SELECT document->>'name' name FROM nutrition_items WHERE id=$1", [
        foreignId,
      ])
    ).rows[0].name,
  ).toBe('Alimento de otro tenant');
  await expect(
    actorTransaction(api, a.userId, a.id, (db) =>
      db.query('UPDATE nutrition_items SET archived=true WHERE id=$1', [foodId]),
    ),
  ).rejects.toMatchObject({ code: '42501' });
});
it('publica siete días de datos congelados; editar fuentes y borrador no altera la asignación ni versiones', async () => {
  const old = (await state()).assignments[0].snapshot,
    document = old.days[0].meals[0].recipe as RecipeSnapshot;
  expect(recipeNutrients(document)).toEqual({ kcal: 150, protein: 0, carbs: 18.75, fat: 7.5 });
  expect(old.days[0].meals[0].alternative.ingredients[0].food.nutrients).toEqual({
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
  });
  expect(recipeNutrients(old.days[0].meals[0].alternative)).toEqual({
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
  });
  expect(
    (await state(a.http, s1.id)).foods.find((f: { id: string }) => f.id === unknownId).document
      .nutrients.kcal,
  ).toBeNull();
  await check(
    await a.http.call('PUT', root + '/nutrition/items/' + foodId, {
      kind: 'food',
      revision: 1,
      archived: false,
      document: {
        ...foodDoc('Nombre cambiado'),
        nutrients: { kcal: 400, protein: 0, carbs: 25, fat: 10 },
      },
    }),
  );
  const again = await check(
    await a.http.call('POST', root + '/nutrition/menus/' + menuId + '/publish', { revision: 1 }),
  );
  expect(again.versionId).toBe(versionId);
  expect((await state()).assignments[0].snapshot).toEqual(old);
  await expect(
    admin.query("UPDATE nutrition_versions SET snapshot='{}' WHERE id=$1", [versionId]),
  ).rejects.toMatchObject({ message: 'IMMUTABLE_VERSION' });
});
it('asigna de forma idempotente, impide solapamiento y CAS evita perder borradores', async () => {
  await check(
    await a.http.call('PUT', root + '/nutrition/assignments/' + assignmentId, {
      versionId,
      studentId: s1.id,
      startsOn: from,
      endsOn: to,
    }),
  );
  await check(
    await a.http.call('PUT', root + '/nutrition/assignments/' + randomUUID(), {
      versionId,
      studentId: s1.id,
      startsOn: today,
      endsOn: to,
    }),
    409,
  );
  await check(
    await a.http.call('PUT', root + '/nutrition/items/' + menuId, {
      kind: 'menu',
      revision: 0,
      archived: false,
      document: menuDoc(),
    }),
    409,
  );
});
it('diario opcional, reintento y CAS; cantidad ausente no se transforma en consumo previsto', async () => {
  await privacy([], false, false);
  const body = {
    assignmentId,
    eatenOn: today,
    mealId,
    requestId: randomUUID(),
    revision: 0,
    state: 'eaten',
    choice: 'main',
    portions: null,
    note: 'Nota privada de comida',
  };
  await check(await s1.http.call('POST', root + '/nutrition/entries', body), 403);
  await privacy([]);
  const old = (await state()).entries.find((e: { mealId: string }) => e.mealId === mealId);
  body.revision = old?.revision ?? 0;
  const first = await check(await s1.http.call('POST', root + '/nutrition/entries', body));
  expect((await check(await s1.http.call('POST', root + '/nutrition/entries', body))).id).toBe(
    first.id,
  );
  await check(
    await s1.http.call('POST', root + '/nutrition/entries', { ...body, requestId: randomUUID() }),
    409,
  );
  const st = await state(),
    e = st.entries.find((e: { id: string }) => e.id === first.id),
    meal = st.assignments[0].snapshot.days[nutritionWeekday(today) - 1].meals[0];
  expect(actualNutrients(e, meal).kcal).toBeNull();
  expect((await state(a.http, s1.id)).entries).toHaveLength(1);
});
it('consentimiento separado para fotos; revocar bloquea nuevas consultas y conserva acceso propio', async () => {
  const { id } = await entry(),
    dataUrl =
      'data:image/png;base64,' +
      (
        await sharp({ create: { width: 8, height: 8, channels: 3, background: '#7ecbb1' } })
          .png()
          .toBuffer()
      ).toString('base64');
  await check(
    await s1.http.call('POST', root + '/nutrition/entries/' + id + '/photos', {
      requestId: randomUUID(),
      dataUrl,
    }),
    403,
  );
  await privacy([], true);
  const requestId = randomUUID(),
    photo = (
      await check(
        await s1.http.call('POST', root + '/nutrition/entries/' + id + '/photos', {
          requestId,
          dataUrl,
        }),
        201,
      )
    ).id;
  expect(
    (
      await check(
        await s1.http.call('POST', root + '/nutrition/entries/' + id + '/photos', {
          requestId,
          dataUrl,
        }),
        201,
      )
    ).id,
  ).toBe(photo);
  const url = root + '/nutrition/photos/' + photo + '/file';
  const open = await a.http.call('GET', url);
  expect(open.statusCode).toBe(200);
  expect(open.headers['cache-control']).toContain('no-store');
  expect(
    Number((await admin.query('SELECT app.document_storage_used($1) used', [a.id])).rows[0].used),
  ).toBeGreaterThan(0);
  await privacy([], false, false);
  await check(await a.http.call('GET', url), 404);
  expect((await s1.http.call('GET', url)).statusCode).toBe(200);
  await check(await s1.http.call('DELETE', root + '/nutrition/photos/' + photo));
  await check(await s1.http.call('GET', url), 404);
});
it('comentarios del coach solo con permiso de diario', async () => {
  const { id } = await entry();
  await privacy([], false, false);
  await check(
    await a.http.call('POST', root + '/nutrition/entries/' + id + '/comments', {
      requestId: randomUUID(),
      message: 'Comentario',
    }),
    403,
  );
  await privacy([]);
  const body = { requestId: randomUUID(), message: 'Comentario compartido' };
  const c = await check(
    await a.http.call('POST', root + '/nutrition/entries/' + id + '/comments', body),
  );
  expect(
    (await check(await a.http.call('POST', root + '/nutrition/entries/' + id + '/comments', body)))
      .id,
  ).toBe(c.id);
  expect((await state()).entries.find((e: { id: string }) => e.id === id).comments).toHaveLength(1);
  await privacy([], false, false);
  expect((await state(a.http, s1.id)).entries).toHaveLength(0);
});
it('PDF de menú usa snapshot y presupuesto común; un permiso revocado impide al worker terminar', async () => {
  const r = await check(
      await a.http.call('POST', root + '/resources', {
        requestId: randomUUID(),
        name: 'Menú privado QA',
        description: '',
        collectionId: null,
      }),
      201,
    ),
    resourceId = r.resource.id;
  const body = { requestId: randomUUID(), kind: 'menu', studentId: s1.id, assignmentId };
  const requested = await check(
      await a.http.call('POST', root + '/resources/' + resourceId + '/versions', body),
      201,
    ),
    id = requested.versionId;
  expect(
    (
      await check(
        await a.http.call('POST', root + '/resources/' + resourceId + '/versions', body),
        201,
      )
    ).versionId,
  ).toBe(id);
  const saved = (
    await admin.query('SELECT snapshot,template_version FROM resource_versions WHERE id=$1', [id])
  ).rows[0];
  expect(saved.template_version).toBe('forma-menu-v1');
  expect(saved.snapshot.menu.days).toHaveLength(7);
  expect(saved.snapshot).not.toHaveProperty('entries');
  expect(saved.snapshot).not.toHaveProperty('photos');
  expect(
    (await check(await a.http.call('GET', root + '/resources/capabilities'))).generatedThisMonth,
  ).toBe(1);
  await check(
    await a.http.call('POST', root + '/resources/' + resourceId + '/access', {
      studentId: s2.id,
      grant: true,
    }),
    400,
  );
  const job = await claimDocumentJob(worker);
  expect(job).toBeTruthy();
  await admin.query("UPDATE app_users SET status='disabled' WHERE id=$1", [a.userId]);
  expect(
    await processDocumentJob(worker, job!, {
      storageRoot: directory,
      render: async () => {
        throw Error('No debe renderizar');
      },
    }),
  ).toBe(false);
  const hidden = await actorTransaction(api, a.userId, a.id, (db) =>
    db.query('SELECT id FROM resource_versions WHERE id=$1', [id]),
  );
  expect(hidden.rowCount).toBe(0);
  await admin.query("UPDATE app_users SET status='active' WHERE id=$1", [a.userId]);
});
it('cancelación conserva historial y bloquea cambios; inventario/retención incluyen fotos de comidas', async () => {
  const id = randomUUID();
  await check(
    await a.http.call('PUT', root + '/nutrition/assignments/' + id, {
      versionId,
      studentId: s2.id,
      startsOn: from,
      endsOn: to,
    }),
  );
  await privacy([], false, true, s2.http, s2.id);
  const body = {
    assignmentId: id,
    eatenOn: today,
    mealId,
    requestId: randomUUID(),
    revision: 0,
    state: 'eaten',
    choice: 'main',
    portions: 1,
    note: '',
  };
  await check(await s2.http.call('POST', root + '/nutrition/entries', body));
  await check(
    await a.http.call('POST', root + '/nutrition/assignments/' + id + '/cancel', {
      revision: 1,
      reason: 'Cambio sintético de menú',
    }),
  );
  await check(
    await s2.http.call('POST', root + '/nutrition/entries', {
      ...body,
      requestId: randomUUID(),
      revision: 1,
    }),
    409,
  );
  expect((await state(s2.http)).entries).toHaveLength(1);
  const photo = (
    await admin.query(
      'SELECT id,storage_key FROM nutrition_photos WHERE organization_id=$1 LIMIT 1',
      [a.id],
    )
  ).rows[0];
  if (photo) {
    const inventory = (await worker.query('SELECT app.media_storage_references() key')).rows.map(
      (r) => r.key,
    );
    expect(inventory).toContain(photo.storage_key);
    await admin.query(
      "UPDATE nutrition_photos SET deleted_at=now()-interval '31 days' WHERE id=$1",
      [photo.id],
    );
    const keys = (await worker.query('SELECT app.media_maintenance() keys')).rows[0].keys;
    expect(keys).toContain(photo.storage_key);
    expect(
      (await admin.query('SELECT byte_size FROM nutrition_photos WHERE id=$1', [photo.id])).rows[0]
        .byte_size,
    ).toBe(0);
  }
});
