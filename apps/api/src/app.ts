import Fastify, { type FastifyRequest, type FastifyReply, type FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createPool } from '@forma/db';
import { registerOrganizations, tenantSlug, actorTransaction } from './organizations.js';
import { ApiProblem, expectedDatabaseProblem } from './problems.js';
import { product, type CurrentUser } from '@forma/shared';
import { proxyTrust, runtimeConfigIssues, type RuntimeConfig } from './runtime-config.js';
import {
  equalTokens,
  generateToken,
  hashPassword,
  tokenDigest,
  verifyPassword,
} from './security.js';

export interface AppConfig extends RuntimeConfig {
  logger?: boolean;
  tenantBaseDomain?: string;
  storageRoot?: string;
  developmentMailbox?: boolean;
}
const credentials = {
  type: 'object',
  additionalProperties: false,
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', maxLength: 254, pattern: '^.+@.+\\..+$' },
    password: { type: 'string', minLength: 1, maxLength: 256 },
    studioSlug: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{2,39}$' },
  },
} as const;

export async function buildApp(config: AppConfig) {
  const issues = runtimeConfigIssues(config);
  if (issues.length) throw new Error(issues.join('\n'));
  const app = Fastify({
    logger: config.logger
      ? {
          redact: [
            'req.headers.cookie',
            'req.headers.authorization',
            'req.body.password',
            'req.body.token',
          ],
          level: 'info',
        }
      : false,
    bodyLimit: 16384,
    ajv: { customOptions: { removeAdditional: false, allowUnionTypes: true } },
    trustProxy: proxyTrust(config.trustedProxyIp),
    genReqId: () => generateToken().slice(0, 12),
  });
  const pool = createPool(config.databaseUrl);
  const sessionName = config.production ? '__Host-forma_session' : 'forma_session';
  const csrfName = config.production ? '__Host-forma_csrf' : 'forma_csrf';
  const baseCookie = {
    path: '/',
    secure: Boolean(config.production),
    httpOnly: true,
    sameSite: 'strict' as const,
  };
  await app.register(websocket, { options: { maxPayload: 2048, perMessageDeflate: false } });
  await app.register(helmet);
  await app.register(cookie, { secret: config.cookieSecret });
  await app.register(rateLimit, { max: config.production ? 100 : 1000, timeWindow: '1 minute' });
  await app.register(swagger, {
    openapi: {
      info: { title: 'Forma API', version: product.version },
      tags: [{ name: 'operations' }, { name: 'identity' }],
    },
  });
  if (!config.production) await app.register(swaggerUi, { routePrefix: '/v1/docs' });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
    let allowedOrigin = !request.headers.origin || request.headers.origin === config.origin;
    if (!allowedOrigin && request.headers.origin) {
      try {
        const origin = new URL(request.headers.origin);
        const base = new URL(config.origin);
        allowedOrigin =
          Boolean(tenantSlug(origin.hostname, config.tenantBaseDomain)) &&
          origin.hostname === request.hostname &&
          origin.protocol === base.protocol &&
          origin.port === base.port;
      } catch {
        allowedOrigin = false;
      }
    }
    if (!allowedOrigin)
      return reply
        .code(403)
        .send({ code: 'INVALID_ORIGIN', message: 'Origen no permitido.', request_id: request.id });
    const signed = request.cookies[csrfName];
    const unsigned = signed ? request.unsignCookie(signed) : undefined;
    const header = request.headers['x-csrf-token'];
    if (
      !unsigned?.valid ||
      !unsigned.value ||
      typeof header !== 'string' ||
      !equalTokens(unsigned.value, header)
    )
      return reply.code(403).send({
        code: 'INVALID_CSRF',
        message: 'Actualiza la página e inténtalo de nuevo.',
        request_id: request.id,
      });
  });
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const expected = error instanceof ApiProblem ? error : expectedDatabaseProblem(error);
    if (expected)
      return reply
        .code(expected.statusCode)
        .send({ code: expected.publicCode, message: expected.message, request_id: request.id });
    const status = typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (status >= 500)
      request.log.error({ code: error.code, request_id: request.id }, 'Request failed');
    reply.code(status).send({
      code: error.validation
        ? 'VALIDATION_ERROR'
        : status >= 500
          ? 'SERVICE_UNAVAILABLE'
          : 'REQUEST_ERROR',
      message:
        status >= 500
          ? 'El servicio no está disponible. Vuelve a intentarlo.'
          : error.validation
            ? 'Revisa los datos ingresados.'
            : 'No se pudo completar la solicitud.',
      request_id: request.id,
    });
  });
  app.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .send({ code: 'NOT_FOUND', message: 'Recurso no encontrado.', request_id: request.id }),
  );
  app.get(
    '/v1/health',
    {
      schema: {
        tags: ['operations'],
        response: {
          200: {
            type: 'object',
            required: ['status', 'service', 'version'],
            properties: {
              status: { const: 'ok' },
              service: { const: 'forma-api' },
              version: { type: 'string' },
            },
          },
        },
      },
    },
    async () => ({ status: 'ok', service: 'forma-api', version: product.version }),
  );
  app.get('/v1/ready', async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
  app.get('/v1/security/csrf', async (_request, reply) => {
    const token = generateToken();
    reply
      .header('Cache-Control', 'no-store')
      .setCookie(csrfName, token, { ...baseCookie, signed: true });
    return { token };
  });

  async function currentUser(request: FastifyRequest): Promise<CurrentUser | null> {
    const secret = request.cookies[sessionName];
    if (!secret) return null;
    const result = await pool.query<{
      id: string;
      email: string;
      full_name: string;
      email_verified_at: Date | null;
      is_superadmin: boolean;
      theme: 'light' | 'dark';
    }>(
      "SELECT u.id,u.email,u.full_name,u.email_verified_at,u.is_superadmin,u.theme FROM auth_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.secret_hash=$1 AND s.expires_at>now() AND s.revoked_at IS NULL AND u.status='active'",
      [tokenDigest(secret)],
    );
    const user = result.rows[0];
    return user
      ? {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          emailVerified: Boolean(user.email_verified_at),
          isSuperadmin: user.is_superadmin,
          theme: user.theme,
        }
      : null;
  }
  async function createSession(reply: FastifyReply, userId: string) {
    const token = generateToken();
    await pool.query(
      "INSERT INTO auth_sessions (user_id,secret_hash,expires_at) VALUES ($1,$2,now()+interval '7 days')",
      [userId, tokenDigest(token)],
    );
    reply
      .header('Cache-Control', 'no-store')
      .setCookie(sessionName, token, { ...baseCookie, maxAge: 604800 });
  }
  const denied = (request: FastifyRequest, reply: FastifyReply) =>
    reply.code(401).send({
      code: 'INVALID_CREDENTIALS',
      message: 'Correo o contraseña incorrectos.',
      request_id: request.id,
    });
  // A dummy Argon2 comparison equalizes work when the account does not exist.
  const dummyHash = await hashPassword(generateToken());
  app.post<{ Body: { email: string; password: string; studioSlug?: string } }>(
    '/v1/auth/login',
    {
      config: { rateLimit: { max: config.production ? 5 : 50, timeWindow: '15 minutes' } },
      schema: { tags: ['identity'], body: credentials },
    },
    async (request, reply) => {
      const result = await pool.query<{ id: string; password_hash: string; status: string }>(
        'SELECT id,password_hash,status FROM app_users WHERE lower(email)=lower($1)',
        [request.body.email.trim()],
      );
      const user = result.rows[0];
      const valid = await verifyPassword(user?.password_hash ?? dummyHash, request.body.password);
      if (!user || user.status !== 'active' || !valid) return denied(request, reply);
      const slug = tenantSlug(request.hostname, config.tenantBaseDomain) ?? request.body.studioSlug;
      if (slug) {
        const accessible = await actorTransaction(pool, user.id, null, async (client) =>
          (
            await client.query<{ items: { slug: string }[] }>('SELECT app.my_organizations() items')
          ).rows[0]!.items.some((org) => org.slug === slug),
        );
        if (!accessible) return denied(request, reply);
      }
      await createSession(reply, user.id);
      return { success: true };
    },
  );
  app.get('/v1/auth/me', { schema: { tags: ['identity'] } }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    const user = await currentUser(request);
    return user
      ? { user }
      : reply.code(401).send({
          code: 'UNAUTHENTICATED',
          message: 'Inicia sesión para continuar.',
          request_id: request.id,
        });
  });
  app.post('/v1/auth/logout', async (request, reply) => {
    const token = request.cookies[sessionName];
    if (token)
      await pool.query('UPDATE auth_sessions SET revoked_at=now() WHERE secret_hash=$1', [
        tokenDigest(token),
      ]);
    reply.clearCookie(sessionName, baseCookie);
    return { success: true };
  });
  app.post<{ Body: { email: string } }>(
    '/v1/auth/password-reset',
    {
      config: { rateLimit: { max: 3, timeWindow: '15 minutes' } },
      schema: {
        tags: ['identity'],
        body: {
          type: 'object',
          required: ['email'],
          additionalProperties: false,
          properties: { email: { type: 'string', maxLength: 254 } },
        },
      },
    },
    async (request) => {
      const token = generateToken();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const user = (
          await client.query<{ id: string; email: string }>(
            "SELECT id,email FROM app_users WHERE lower(email)=lower($1) AND status='active'",
            [request.body.email.trim()],
          )
        ).rows[0];
        if (user) {
          await client.query(
            "INSERT INTO password_reset_tokens (user_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '30 minutes')",
            [user.id, tokenDigest(token)],
          );
          await client.query(
            'INSERT INTO jobs (kind,deduplication_key,payload) VALUES ($1,$2,$3)',
            [
              'email.password_reset',
              tokenDigest(token),
              JSON.stringify({
                userId: user.id,
                to: user.email,
                url: `${config.origin}/recuperar?token=${token}`,
              }),
            ],
          );
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      return {
        message: 'Si el correo está registrado, recibirás un enlace para recuperar el acceso.',
      };
    },
  );
  app.post<{ Body: { token: string; password: string } }>(
    '/v1/auth/password-reset/confirm',
    {
      schema: {
        tags: ['identity'],
        body: {
          type: 'object',
          required: ['token', 'password'],
          additionalProperties: false,
          properties: {
            token: { type: 'string', minLength: 32, maxLength: 128 },
            password: { type: 'string', minLength: 12, maxLength: 256 },
          },
        },
      },
    },
    async (request, reply) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const reset = (
          await client.query<{ user_id: string }>(
            'UPDATE password_reset_tokens SET consumed_at=now() WHERE token_hash=$1 AND expires_at>now() AND consumed_at IS NULL RETURNING user_id',
            [tokenDigest(request.body.token)],
          )
        ).rows[0];
        if (!reset) {
          await client.query('ROLLBACK');
          return reply.code(400).send({
            code: 'INVALID_TOKEN',
            message: 'El enlace venció o ya fue utilizado.',
            request_id: request.id,
          });
        }
        await client.query('UPDATE app_users SET password_hash=$1 WHERE id=$2', [
          await hashPassword(request.body.password),
          reset.user_id,
        ]);
        await client.query('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1', [
          reset.user_id,
        ]);
        await client.query(
          'UPDATE password_reset_tokens SET consumed_at=now() WHERE user_id=$1 AND consumed_at IS NULL',
          [reset.user_id],
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
  await registerOrganizations(app, { pool, config, currentUser, createSession });
  app.addHook('onClose', async () => {
    await pool.end();
  });
  return app;
}
