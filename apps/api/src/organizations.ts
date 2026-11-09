import { registerPwa } from './pwa.js';
import { registerBilling } from './billing.js';
import { registerResources } from './resources.js';
import { registerNutrition } from './nutrition.js';
import { registerFollowup } from './followup.js';
import { registerAgenda } from './agenda.js';
import { registerCommerce } from './commerce.js';
import { registerCoachStart } from './coach-start.js';
import { registerCoachOptions } from './coach-options.js';
import { registerMonthly } from './monthly.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool, PoolClient } from 'pg';
import sharp from 'sharp';
import type { Brand, CurrentUser, OrganizationSummary, StudentRecord } from '@forma/shared';
import type { AppConfig } from './app.js';
import { generateToken, tokenDigest, hashPassword, verifyPassword } from './security.js';
import { PrivateStorage } from './storage.js';
import { registerLibrary } from './library.js';
import { registerPrograms } from './programs.js';
import { registerWorkouts } from './workouts.js';
import { registerProgress } from './progress.js';
import { registerAnthropometry } from './anthropometry.js';
import { registerStudentRecord } from './student-record.js';
import { problem } from './problems.js';

const uuidPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const orgParams = {
  type: 'object',
  required: ['organizationId'],
  properties: { organizationId: { type: 'string', pattern: uuidPattern } },
} as const;
const studentParams = {
  type: 'object',
  required: ['organizationId', 'studentId'],
  properties: { ...orgParams.properties, studentId: { type: 'string', pattern: uuidPattern } },
} as const;
const nameField = { type: 'string', minLength: 2, maxLength: 100 } as const;
const emailField = {
  type: 'string',
  maxLength: 254,
  pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
} as const;
const tokenField = { type: 'string', minLength: 32, maxLength: 128 } as const;
const consentField = { type: 'boolean', const: true } as const;
const studioFields = {
  name: { type: 'string', minLength: 2, maxLength: 40 },
  slug: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{2,39}$' },
  kind: { type: 'string', const: 'coach' },
  accent: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
  plan: { type: 'string', enum: ['basic', 'pro'] },
} as const;
const studioRequired = ['name', 'slug', 'kind', 'accent', 'plan'];
type StudioInput = {
  name: string;
  slug: string;
  kind: 'coach';
  accent: string;
  plan: 'basic' | 'pro';
};
type StudentRow = {
  id: string;
  display_name: string;
  contact_email: string;
  goal: string;
  status: StudentRecord['status'];
  user_id: string | null;
  version: number;
  created_at: Date;
};
const studentDTO = (s: StudentRow): StudentRecord => ({
  id: s.id,
  displayName: s.display_name,
  email: s.contact_email,
  goal: s.goal,
  status: s.status,
  userId: s.user_id,
  version: s.version,
  createdAt: s.created_at.toISOString(),
});
const brandDTO = (b: Brand & { logoId?: string | null }) => ({
  ...b,
  logoId: undefined,
  logoUrl: b.logoId ? `/v1/public/studios/${b.slug}/logo?v=${b.logoId}` : null,
});

export function tenantSlug(hostname: string, baseDomain?: string): string | null {
  if (!baseDomain) return null;
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const base = baseDomain.toLowerCase().replace(/\.$/, '');
  if (!host.endsWith(`.${base}`)) return null;
  const slug = host.slice(0, -base.length - 1);
  return /^[a-z0-9][a-z0-9-]{2,39}$/.test(slug) ? slug : null;
}
export async function actorTransaction<T>(
  pool: Pool,
  userId: string,
  organizationId: string | null,
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true)",
      [userId, organizationId ?? ''],
    );
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
interface Options {
  pool: Pool;
  config: AppConfig;
  currentUser: (request: FastifyRequest) => Promise<CurrentUser | null>;
  createSession: (reply: FastifyReply, userId: string) => Promise<void>;
}

export async function registerOrganizations(
  app: FastifyInstance,
  { pool, config, currentUser, createSession }: Options,
) {
  const storage = new PrivateStorage(
    config.storageRoot ?? process.env.STORAGE_PATH ?? '.local/storage',
    262144,
  );
  async function requireUser(request: FastifyRequest) {
    const user = await currentUser(request);
    if (!user) throw problem(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
    return user;
  }
  async function organizations(client: PoolClient) {
    return (
      await client.query<{ data: OrganizationSummary[] }>('SELECT app.my_organizations() data')
    ).rows[0]!.data;
  }
  async function context(request: FastifyRequest, id: string, roles?: string[]) {
    const user = await requireUser(request);
    const slug = tenantSlug(request.hostname, config.tenantBaseDomain);
    if (slug) {
      const brand = (
        await pool.query<{ brand: Brand | null }>('SELECT app.public_brand($1) brand', [slug])
      ).rows[0]?.brand;
      if (!brand || brand.id !== id)
        throw problem(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró el estudio.');
    }
    const org = await actorTransaction(pool, user.id, null, async (client) =>
      (await organizations(client)).find((o) => o.id === id),
    );
    if (!org) throw problem(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró el estudio.');
    if (org.status === 'suspended')
      throw problem(
        403,
        'ORGANIZATION_SUSPENDED',
        'El estudio tiene el acceso suspendido. Contacta al administrador.',
      );
    if (org.role === 'student' && org.studentStatus !== 'active')
      throw problem(
        403,
        'STUDENT_INACTIVE',
        'Tu acceso está pausado o archivado. Contacta con tu coach.',
      );
    if (roles && !roles.includes(org.role))
      throw problem(403, 'FORBIDDEN', 'No tienes permiso para esta operación.');
    return { user, org };
  }
  async function verifyMail(client: PoolClient, userId: string, email: string) {
    const token = generateToken();
    await client.query(
      "INSERT INTO email_verification_tokens(user_id,token_hash,expires_at)VALUES($1,$2,now()+interval '24 hours')",
      [userId, tokenDigest(token)],
    );
    await client.query('INSERT INTO jobs(kind,deduplication_key,payload)VALUES($1,$2,$3)', [
      'email.verification',
      tokenDigest(token),
      JSON.stringify({ userId, to: email, url: `${config.origin}/verificar?token=${token}` }),
    ]);
  }
  const plansQuery =
    "SELECT p.code,p.name,v.id,v.version_no,v.per_student_price_pyg,v.student_limit,v.features FROM saas_plans p JOIN saas_plan_versions v ON v.plan_id=p.id WHERE p.code IN ('basic','pro') AND v.version_no=(SELECT max(v2.version_no) FROM saas_plan_versions v2 WHERE v2.plan_id=p.id) ORDER BY v.per_student_price_pyg";
  app.get('/v1/plans', { schema: { tags: ['plans'] } }, async () => ({
    plans: (await pool.query(plansQuery)).rows.map((p) => ({
      code: p.code,
      name: p.name,
      versionId: p.id,
      version: p.version_no,
      perStudentPricePyg: Number(p.per_student_price_pyg),
      studentLimit: p.student_limit,
      features: p.features,
      trialDays: 14,
    })),
  }));
  app.get<{ Params: { slug: string } }>(
    '/v1/public/studios/:slug',
    {
      schema: {
        tags: ['branding'],
        params: {
          type: 'object',
          required: ['slug'],
          properties: { slug: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{2,39}$' } },
        },
      },
    },
    async (request) => {
      const brand = (
        await pool.query<{ brand: (Brand & { logoId: string | null }) | null }>(
          'SELECT app.public_brand($1) brand',
          [request.params.slug],
        )
      ).rows[0]?.brand;
      if (!brand) throw problem(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró el estudio.');
      return { brand: brandDTO(brand) };
    },
  );
  app.get<{ Params: { slug: string } }>('/v1/public/studios/:slug/logo', async (request, reply) => {
    const key = (
      await pool.query<{ key: string | null }>('SELECT app.public_logo($1) key', [
        request.params.slug,
      ])
    ).rows[0]?.key;
    if (!key) throw problem(404, 'NOT_FOUND', 'No se encontró el logo.');
    reply.header('Content-Type', 'image/webp').header('Cache-Control', 'public, max-age=60');
    return storage.read(key);
  });
  app.get('/v1/organizations', async (request) => {
    const user = await requireUser(request);
    return { organizations: await actorTransaction(pool, user.id, null, organizations) };
  });
  app.post<{
    Body: StudioInput & {
      fullName: string;
      email: string;
      password: string;
      privacyAccepted: boolean;
    };
  }>(
    '/v1/auth/register-coach',
    {
      config: { rateLimit: { max: config.production ? 8 : 50, timeWindow: '15 minutes' } },
      schema: {
        tags: ['identity'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: [...studioRequired, 'fullName', 'email', 'password', 'privacyAccepted'],
          properties: {
            ...studioFields,
            fullName: nameField,
            email: emailField,
            password: { type: 'string', minLength: 12, maxLength: 256 },
            privacyAccepted: consentField,
          },
        },
      },
    },
    async (request, reply) => {
      const input = request.body;
      const email = input.email.trim().toLowerCase();
      const userId = crypto.randomUUID();
      const digest = await hashPassword(input.password);
      const organizationId = await actorTransaction(pool, userId, null, async (client) => {
        await client.query(
          "INSERT INTO app_users(id,email,password_hash,full_name,privacy_version,privacy_accepted_at)VALUES($1,$2,$3,$4,'2026-10-t02',now())",
          [userId, email, digest, input.fullName.trim()],
        );
        const org = (
          await client.query<{ id: string }>('SELECT app.create_organization($1,$2,$3,$4,$5) id', [
            input.name.trim(),
            input.slug,
            input.kind,
            input.accent,
            input.plan,
          ])
        ).rows[0]!.id;
        await verifyMail(client, userId, email);
        return org;
      });
      await createSession(reply, userId);
      reply.code(201);
      return { organizationId, emailVerification: 'queued' };
    },
  );
  app.post<{ Body: StudioInput }>(
    '/v1/organizations',
    {
      schema: {
        tags: ['organizations'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: studioRequired,
          properties: studioFields,
        },
      },
    },
    async (request, reply) => {
      const user = await requireUser(request);
      const input = request.body;
      const id = await actorTransaction(
        pool,
        user.id,
        null,
        async (client) =>
          (
            await client.query<{ id: string }>(
              'SELECT app.create_organization($1,$2,$3,$4,$5) id',
              [input.name.trim(), input.slug, input.kind, input.accent, input.plan],
            )
          ).rows[0]!.id,
      );
      reply.code(201);
      return { organizationId: id };
    },
  );
  app.post<{ Body: { token: string } }>(
    '/v1/auth/verify-email',
    {
      schema: {
        tags: ['identity'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token'],
          properties: { token: tokenField },
        },
      },
    },
    async (request) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const row = (
          await client.query<{ user_id: string }>(
            'UPDATE email_verification_tokens SET consumed_at=clock_timestamp() WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>clock_timestamp() RETURNING user_id',
            [tokenDigest(request.body.token)],
          )
        ).rows[0];
        if (!row) throw problem(400, 'INVALID_TOKEN', 'El enlace venció o ya fue utilizado.');
        await client.query(
          'UPDATE app_users SET email_verified_at=coalesce(email_verified_at,clock_timestamp()) WHERE id=$1',
          [row.user_id],
        );
        await client.query(
          'UPDATE email_verification_tokens SET consumed_at=clock_timestamp() WHERE user_id=$1 AND consumed_at IS NULL',
          [row.user_id],
        );
        await client.query('COMMIT');
        return { success: true };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  );
  app.post(
    '/v1/auth/verification-email',
    { config: { rateLimit: { max: 3, timeWindow: '15 minutes' } } },
    async (request) => {
      const user = await requireUser(request);
      if (!user.emailVerified)
        await actorTransaction(pool, user.id, null, (client) =>
          verifyMail(client, user.id, user.email),
        );
      return { status: user.emailVerified ? 'verified' : 'queued' };
    },
  );
  app.put<{ Body: { theme: 'light' | 'dark' } }>(
    '/v1/auth/preferences',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['theme'],
          properties: { theme: { type: 'string', enum: ['light', 'dark'] } },
        },
      },
    },
    async (request) => {
      const user = await requireUser(request);
      await pool.query('UPDATE app_users SET theme=$1 WHERE id=$2', [request.body.theme, user.id]);
      return { theme: request.body.theme };
    },
  );
  if (config.developmentMailbox && !config.production)
    app.get('/v1/development/emails', async (request) => {
      const user = await requireUser(request);
      return {
        emails: await actorTransaction(
          pool,
          user.id,
          null,
          async (client) =>
            (await client.query('SELECT app.development_mail() emails')).rows[0].emails,
        ),
      };
    });
  app.get<{ Params: { organizationId: string } }>(
    '/v1/organizations/:organizationId',
    { schema: { params: orgParams, tags: ['organizations'] } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      return actorTransaction(pool, user.id, org.id, async (client) => {
        const brand = (
          await client.query<{ brand: Brand & { logoId: string | null } }>(
            'SELECT app.public_brand($1) brand',
            [org.slug],
          )
        ).rows[0]!.brand;
        return { organization: org, brand: brandDTO(brand) };
      });
    },
  );
  app.put<{
    Params: { organizationId: string };
    Body: {
      name: string;
      accent: string;
      welcomeMessage: string;
      biography: string;
      contactEmail: string | null;
    };
  }>(
    '/v1/organizations/:organizationId/branding',
    {
      schema: {
        params: orgParams,
        tags: ['branding'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'accent', 'welcomeMessage', 'biography', 'contactEmail'],
          properties: {
            name: studioFields.name,
            accent: studioFields.accent,
            welcomeMessage: { type: 'string', maxLength: 200 },
            biography: { type: 'string', maxLength: 1000 },
            contactEmail: { anyOf: [emailField, { type: 'null' }] },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, ['owner']);
      const b = request.body;
      await actorTransaction(pool, user.id, org.id, async (client) => {
        await client.query('UPDATE organizations SET name=$1 WHERE id=$2', [b.name.trim(), org.id]);
        await client.query(
          'UPDATE organization_branding SET primary_color=$1,welcome_message=$2,biography=$3,contact_email=$4,updated_at=clock_timestamp() WHERE organization_id=$5',
          [b.accent, b.welcomeMessage.trim(), b.biography.trim(), b.contactEmail, org.id],
        );
        await client.query(
          "INSERT INTO audit_logs(organization_id,actor_user_id,action)VALUES($1,$2,'branding.updated')",
          [org.id, user.id],
        );
      });
      return { success: true };
    },
  );
  app.post<{ Params: { organizationId: string }; Body: { dataUrl: string } }>(
    '/v1/organizations/:organizationId/branding/logo',
    {
      bodyLimit: 400000,
      schema: {
        params: orgParams,
        tags: ['branding'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['dataUrl'],
          properties: { dataUrl: { type: 'string', maxLength: 350000 } },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, ['owner']);
      const match = /^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(
        request.body.dataUrl,
      );
      if (!match)
        throw problem(400, 'INVALID_LOGO', 'Sube una imagen PNG, JPEG o WebP de hasta 256 KB.');
      let bytes: Buffer;
      try {
        const input = Buffer.from(match[2]!, 'base64');
        if (input.length > 262144) throw new Error('size');
        const image = sharp(input, { limitInputPixels: 4194304, animated: false });
        const metadata = await image.metadata();
        if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '')) throw new Error('format');
        bytes = await image
          .rotate()
          .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        throw problem(400, 'INVALID_LOGO', 'La imagen no se pudo leer. Prueba con otra.');
      }
      if (bytes.length > 262144)
        throw problem(400, 'INVALID_LOGO', 'El logo supera el tamaño permitido.');
      const key = await storage.put(bytes, 'webp');
      try {
        await actorTransaction(pool, user.id, org.id, async (client) => {
          await client.query('SELECT app.assert_logo_budget($1)', [bytes.length]);
          const id = (
            await client.query<{ id: string }>(
              "INSERT INTO organization_logo_assets(organization_id,storage_key,byte_size,mime_type)VALUES($1,$2,$3,'image/webp') RETURNING id",
              [org.id, key, bytes.length],
            )
          ).rows[0]!.id;
          await client.query(
            'UPDATE organization_branding SET logo_asset_id=$1,updated_at=clock_timestamp() WHERE organization_id=$2',
            [id, org.id],
          );
          await client.query(
            "INSERT INTO audit_logs(organization_id,actor_user_id,action)VALUES($1,$2,'branding.logo_updated')",
            [org.id, user.id],
          );
        });
      } catch (error) {
        await storage.remove(key).catch(() => {});
        throw error;
      }
      return { success: true };
    },
  );
  app.delete<{ Params: { organizationId: string } }>(
    '/v1/organizations/:organizationId/branding/logo',
    { schema: { params: orgParams } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, ['owner']);
      await actorTransaction(pool, user.id, org.id, async (client) => {
        await client.query(
          'UPDATE organization_branding SET logo_asset_id=NULL,updated_at=clock_timestamp() WHERE organization_id=$1',
          [org.id],
        );
        await client.query(
          "INSERT INTO audit_logs(organization_id,actor_user_id,action)VALUES($1,$2,'branding.logo_removed')",
          [org.id, user.id],
        );
      });
      return { success: true };
    },
  );
  app.get<{ Params: { organizationId: string }; Querystring: { cursor?: string; limit?: number } }>(
    '/v1/organizations/:organizationId/students',
    {
      schema: {
        params: orgParams,
        tags: ['students'],
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            cursor: { type: 'string', pattern: uuidPattern },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      return actorTransaction(pool, user.id, org.id, async (client) => {
        const limit = request.query.limit ?? 50;
        const rows = (
          await client.query<StudentRow>(
            'SELECT * FROM students WHERE organization_id=$1 AND ($2::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM students WHERE id=$2 AND organization_id=$1)) ORDER BY created_at DESC,id DESC LIMIT $3',
            [org.id, request.query.cursor ?? null, limit],
          )
        ).rows;
        return {
          students: rows.map(studentDTO),
          nextCursor: rows.length === limit ? rows.at(-1)!.id : null,
        };
      });
    },
  );
  app.post<{
    Params: { organizationId: string };
    Body: { displayName: string; email: string; goal: string };
  }>(
    '/v1/organizations/:organizationId/students',
    {
      schema: {
        params: orgParams,
        tags: ['students'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['displayName', 'email', 'goal'],
          properties: {
            displayName: nameField,
            email: emailField,
            goal: { type: 'string', maxLength: 300 },
          },
        },
      },
    },
    async (request, reply) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      const input = request.body;
      const student = await actorTransaction(pool, user.id, org.id, async (client) => {
        const id = (
          await client.query<{ id: string }>('SELECT app.create_student($1,$2,$3) id', [
            input.displayName.trim(),
            input.email.trim(),
            input.goal.trim(),
          ])
        ).rows[0]!.id;
        return (
          await client.query<StudentRow>(
            'SELECT * FROM students WHERE id=$1 AND organization_id=$2',
            [id, org.id],
          )
        ).rows[0]!;
      });
      reply.code(201);
      return { student: studentDTO(student) };
    },
  );
  app.get<{ Params: { organizationId: string; studentId: string } }>(
    '/v1/organizations/:organizationId/students/:studentId',
    { schema: { params: studentParams, tags: ['students'] } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      const row = await actorTransaction(
        pool,
        user.id,
        org.id,
        async (client) =>
          (
            await client.query<StudentRow>(
              'SELECT * FROM students WHERE id=$1 AND organization_id=$2',
              [request.params.studentId, org.id],
            )
          ).rows[0],
      );
      if (!row) throw problem(404, 'STUDENT_NOT_FOUND', 'No se encontró el alumno.');
      return { student: studentDTO(row) };
    },
  );
  app.put<{
    Params: { organizationId: string; studentId: string };
    Body: { displayName: string; goal: string; version: number };
  }>(
    '/v1/organizations/:organizationId/students/:studentId',
    {
      schema: {
        params: studentParams,
        tags: ['students'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['displayName', 'goal', 'version'],
          properties: {
            displayName: nameField,
            goal: { type: 'string', maxLength: 300 },
            version: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      const b = request.body;
      return actorTransaction(pool, user.id, org.id, async (client) => {
        const existing = (
          await client.query<StudentRow>(
            'SELECT * FROM students WHERE id=$1 AND organization_id=$2 FOR UPDATE',
            [request.params.studentId, org.id],
          )
        ).rows[0];
        if (!existing) throw problem(404, 'STUDENT_NOT_FOUND', 'No se encontró el alumno.');
        if (existing.version !== b.version)
          throw problem(409, 'STALE_STUDENT', 'Actualiza la ficha antes de guardar.');
        const row = (
          await client.query<StudentRow>(
            'UPDATE students SET display_name=$1,goal=$2,version=version+1,updated_at=clock_timestamp() WHERE id=$3 AND organization_id=$4 RETURNING *',
            [b.displayName.trim(), b.goal.trim(), existing.id, org.id],
          )
        ).rows[0]!;
        await client.query(
          "INSERT INTO audit_logs(organization_id,actor_user_id,action,metadata)VALUES($1,$2,'student.profile_updated',$3)",
          [org.id, user.id, JSON.stringify({ studentId: existing.id })],
        );
        return { student: studentDTO(row) };
      });
    },
  );
  app.patch<{
    Params: { organizationId: string; studentId: string };
    Body: { status: string; version: number; reason: string };
  }>(
    '/v1/organizations/:organizationId/students/:studentId/state',
    {
      schema: {
        params: studentParams,
        tags: ['students'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['status', 'version', 'reason'],
          properties: {
            status: { type: 'string', enum: ['invited', 'active', 'paused', 'archived'] },
            version: { type: 'integer', minimum: 1 },
            reason: { type: 'string', minLength: 3, maxLength: 300 },
          },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      return actorTransaction(pool, user.id, org.id, async (client) => {
        await client.query('SELECT app.change_student_state($1,$2,$3,$4)', [
          request.params.studentId,
          request.body.status,
          request.body.version,
          request.body.reason.trim(),
        ]);
        const student = (
          await client.query<StudentRow>(
            'SELECT * FROM students WHERE id=$1 AND organization_id=$2',
            [request.params.studentId, org.id],
          )
        ).rows[0]!;
        return { student: studentDTO(student) };
      });
    },
  );
  app.post<{ Params: { organizationId: string; studentId: string } }>(
    '/v1/organizations/:organizationId/students/:studentId/invitation',
    {
      schema: { params: studentParams, tags: ['students'] },
      config: { rateLimit: { max: config.production ? 20 : 100, timeWindow: '15 minutes' } },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, [
        'owner',
        'coach',
      ]);
      const token = generateToken();
      const url = `${config.origin}/invitar?token=${token}`;
      const invitation = await actorTransaction(pool, user.id, org.id, async (client) => {
        const info = (
          await client.query<{ info: { email: string; expiresAt: string } }>(
            'SELECT app.create_invitation($1,$2) info',
            [request.params.studentId, tokenDigest(token)],
          )
        ).rows[0]!.info;
        await client.query('INSERT INTO jobs(kind,deduplication_key,payload)VALUES($1,$2,$3)', [
          'email.invitation',
          tokenDigest(token),
          JSON.stringify({ to: info.email, url, studioName: org.name }),
        ]);
        return info;
      });
      return { url, expiresAt: invitation.expiresAt, delivery: 'queued' };
    },
  );
  app.post<{ Body: { token: string } }>(
    '/v1/invitations/inspect',
    {
      schema: {
        tags: ['identity'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token'],
          properties: { token: tokenField },
        },
      },
    },
    async (request) => {
      const invitation = (
        await pool.query<{
          invitation:
            | (Omit<import('@forma/shared').PublicInvitation, 'brand'> & {
                brand: Brand & { logoId: string | null };
              })
            | null;
        }>('SELECT app.inspect_invitation($1) invitation', [tokenDigest(request.body.token)])
      ).rows[0]?.invitation;
      if (!invitation)
        throw problem(
          400,
          'INVALID_INVITATION',
          'La invitación venció o ya no está disponible. Solicita una nueva.',
        );
      return { invitation: { ...invitation, brand: brandDTO(invitation.brand) } };
    },
  );
  app.post<{
    Body: {
      token: string;
      fullName: string;
      password?: string;
      goal: string;
      privacyAccepted: boolean;
    };
  }>(
    '/v1/invitations/accept',
    {
      config: { rateLimit: { max: config.production ? 8 : 50, timeWindow: '15 minutes' } },
      schema: {
        tags: ['identity'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['token', 'fullName', 'goal', 'privacyAccepted'],
          properties: {
            token: tokenField,
            fullName: nameField,
            password: { type: 'string', minLength: 1, maxLength: 256 },
            goal: { type: 'string', maxLength: 300 },
            privacyAccepted: consentField,
          },
        },
      },
    },
    async (request, reply) => {
      const input = request.body;
      const info = (
        await pool.query<{ info: { email: string } | null }>(
          'SELECT app.inspect_invitation($1) info',
          [tokenDigest(input.token)],
        )
      ).rows[0]?.info;
      if (!info)
        throw problem(400, 'INVALID_INVITATION', 'La invitación venció o ya no está disponible.');
      const session = await currentUser(request);
      const existing = (
        await pool.query<{ id: string; password_hash: string; status: string }>(
          'SELECT id,password_hash,status FROM app_users WHERE lower(email)=lower($1)',
          [info.email],
        )
      ).rows[0];
      if (session && session.email.toLowerCase() !== info.email.toLowerCase())
        throw problem(
          403,
          'INVITATION_ACCOUNT_MISMATCH',
          'Cierra tu sesión actual: esta invitación es para otra cuenta.',
        );
      if (existing && existing.status !== 'active')
        throw problem(403, 'ACCOUNT_DISABLED', 'La cuenta no está habilitada.');
      if (
        existing &&
        !session &&
        (!input.password || !(await verifyPassword(existing.password_hash, input.password)))
      )
        throw problem(
          401,
          'INVALID_CREDENTIALS',
          'Si ya tienes cuenta, usa tu contraseña actual para aceptar la invitación.',
        );
      if (!existing && (!input.password || input.password.length < 12))
        throw problem(400, 'WEAK_PASSWORD', 'Usa una contraseña de al menos 12 caracteres.');
      const userId = existing?.id ?? crypto.randomUUID();
      const newHash = existing ? null : await hashPassword(input.password!);
      const organizationId = await actorTransaction(pool, userId, null, async (client) => {
        if (!existing)
          await client.query(
            "INSERT INTO app_users(id,email,password_hash,full_name,privacy_version,privacy_accepted_at)VALUES($1,$2,$3,$4,'2026-10-t02',now())",
            [userId, info.email, newHash, input.fullName.trim()],
          );
        return (
          await client.query<{ id: string }>('SELECT app.accept_invitation($1,$2,$3) id', [
            tokenDigest(input.token),
            input.fullName.trim(),
            input.goal.trim(),
          ])
        ).rows[0]!.id;
      });
      await createSession(reply, userId);
      return { organizationId };
    },
  );
  app.get<{ Params: { organizationId: string } }>(
    '/v1/organizations/:organizationId/subscription',
    { schema: { params: orgParams, tags: ['plans'] } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, ['owner']);
      return actorTransaction(pool, user.id, org.id, async (client) => {
        const row = (
          await client.query(
            "SELECT s.status,s.trial_ends_at,p.name,p.code,v.version_no,v.per_student_price_pyg,coalesce(c.student_limit,v.student_limit) student_limit,c.organization_id IS NOT NULL manual_mode,c.monthly_price_pyg,v.features,(SELECT count(*) FROM students WHERE organization_id=$1 AND status='active') enabled,(SELECT count(*) FROM students WHERE organization_id=$1) total FROM saas_subscriptions s JOIN saas_plan_versions v ON v.id=s.plan_version_id JOIN saas_plans p ON p.id=v.plan_id LEFT JOIN manual_coach_controls c ON c.organization_id=s.organization_id WHERE s.organization_id=$1",
            [org.id],
          )
        ).rows[0];
        if (!row) throw problem(404, 'NOT_FOUND', 'No hay suscripción.');
        const usage = (
          await client.query(
            'SELECT student_id,opened_at,closed_at FROM student_billable_intervals WHERE organization_id=$1 ORDER BY opened_at DESC LIMIT 100',
            [org.id],
          )
        ).rows;
        return {
          subscription: {
            plan: row.name,
            planCode: row.code,
            version: row.version_no,
            perStudentPricePyg: Number(row.per_student_price_pyg),
            studentLimit: row.student_limit,
            features: row.features,
            manualMode: row.manual_mode,
            monthlyPricePyg: row.monthly_price_pyg === null ? null : Number(row.monthly_price_pyg),
            enabledStudents: Number(row.enabled),
            totalStudents: Number(row.total),
            status: row.status,
            trialEndsAt: row.trial_ends_at,
          },
          intervals: usage,
        };
      });
    },
  );
  app.get<{ Params: { organizationId: string } }>(
    '/v1/organizations/:organizationId/portal',
    { schema: { params: orgParams, tags: ['students'] } },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId);
      return actorTransaction(pool, user.id, org.id, async (client) => {
        const row = (
          await client.query<StudentRow>(
            'SELECT * FROM students WHERE organization_id=$1 AND user_id=$2',
            [org.id, user.id],
          )
        ).rows[0];
        return { preview: org.role !== 'student', student: row ? studentDTO(row) : null };
      });
    },
  );
  app.put<{ Params: { organizationId: string }; Body: { displayName: string; goal: string } }>(
    '/v1/organizations/:organizationId/portal/profile',
    {
      schema: {
        params: orgParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['displayName', 'goal'],
          properties: { displayName: nameField, goal: { type: 'string', maxLength: 300 } },
        },
      },
    },
    async (request) => {
      const { user, org } = await context(request, request.params.organizationId, ['student']);
      return actorTransaction(pool, user.id, org.id, async (client) => {
        const row = (
          await client.query<StudentRow>(
            'UPDATE students SET display_name=$1,goal=$2,version=version+1,updated_at=clock_timestamp() WHERE organization_id=$3 AND user_id=$4 RETURNING *',
            [request.body.displayName.trim(), request.body.goal.trim(), org.id, user.id],
          )
        ).rows[0];
        if (!row) throw problem(404, 'STUDENT_NOT_FOUND', 'No se encontró el perfil.');
        return { student: studentDTO(row) };
      });
    },
  );
  app.get('/v1/admin/organizations', async (request) => {
    const user = await requireUser(request);
    return {
      organizations: await actorTransaction(
        pool,
        user.id,
        null,
        async (client) =>
          (await client.query('SELECT app.admin_organizations() data')).rows[0].data,
      ),
    };
  });
  app.patch<{
    Params: { organizationId: string };
    Body: { status: 'suspended' | 'resume'; reason: string };
  }>(
    '/v1/admin/organizations/:organizationId/state',
    {
      schema: {
        params: orgParams,
        tags: ['administration'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['status', 'reason'],
          properties: {
            status: { type: 'string', enum: ['suspended', 'resume'] },
            reason: { type: 'string', minLength: 10, maxLength: 500 },
          },
        },
      },
    },
    async (request) => {
      const user = await requireUser(request);
      await actorTransaction(pool, user.id, null, (client) =>
        client.query('SELECT app.admin_org_state($1,$2,$3)', [
          request.params.organizationId,
          request.body.status,
          request.body.reason.trim(),
        ]),
      );
      return { success: true };
    },
  );
  app.patch<{
    Params: { organizationId: string };
    Body: { plan: 'basic' | 'pro'; reason: string };
  }>(
    '/v1/admin/organizations/:organizationId/plan',
    {
      schema: {
        params: orgParams,
        tags: ['administration'],
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['plan', 'reason'],
          properties: {
            plan: { type: 'string', enum: ['basic', 'pro'] },
            reason: { type: 'string', minLength: 10, maxLength: 500 },
          },
        },
      },
    },
    async (request) => {
      const user = await requireUser(request);
      await actorTransaction(pool, user.id, null, (client) =>
        client.query('SELECT app.admin_change_plan($1,$2,$3)', [
          request.params.organizationId,
          request.body.plan,
          request.body.reason.trim(),
        ]),
      );
      return { success: true };
    },
  );
  await registerPwa(app, pool, config);
  await registerBilling(app, { pool, config, requireUser });
  await registerLibrary(app, { pool, config, context });
  await registerResources(app, { pool, config, context });
  await registerNutrition(app, { pool, config, context });
  await registerFollowup(app, { pool, config, context });
  await registerAgenda(app, { pool, config, context });
  await registerCommerce(app, { pool, config, context });
  await registerCoachStart(app, { pool, config, context });
  registerMonthly(app, { pool, config, context, requireUser });
  registerCoachOptions(app, { pool, context });
  await registerPrograms(app, { pool, context });
  await registerWorkouts(app, { pool, context });
  await registerProgress(app, { pool, context, config });
  await registerAnthropometry(app, { pool, context });
  await registerStudentRecord(app, { pool, context });
}
