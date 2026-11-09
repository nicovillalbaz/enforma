import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app.js';
const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
async function app() {
  const instance = await buildApp({
    origin: 'http://127.0.0.1:5173',
    cookieSecret: 'test-only-cookie-secret-at-least-32-characters',
    databaseUrl: 'postgres://none:none@127.0.0.1:1/none',
  });
  apps.push(instance);
  return instance;
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((server) => server.close()));
});
describe('API boundaries', () => {
  it('keeps production registration and invitation throttles despite higher local limits', async () => {
    const server = await buildApp({
      origin: 'https://forma.test',
      cookieSecret: 'production-rate-limit-cookie-secret-more-than-32',
      production: true,
      databaseUrl: 'postgres://forma_api:none@127.0.0.1:1/none',
    });
    apps.push(server);
    const csrf = await server.inject('/v1/security/csrf');
    const headers = {
      cookie: String(csrf.headers['set-cookie']).split(';')[0]!,
      'x-csrf-token': csrf.json().token,
    };
    for (const url of ['/v1/auth/register-coach', '/v1/invitations/accept']) {
      for (let attempt = 0; attempt < 8; attempt++)
        expect(
          (
            await server.inject({
              method: 'POST',
              url,
              headers,
              payload: {},
            })
          ).statusCode,
        ).toBe(400);
      expect(
        (
          await server.inject({
            method: 'POST',
            url,
            headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(429);
    }
    const invitationUrl = '/v1/organizations/invalid/students/invalid/invitation';
    for (let attempt = 0; attempt < 20; attempt++)
      expect(
        (await server.inject({ method: 'POST', url: invitationUrl, headers })).statusCode,
      ).toBe(400);
    expect((await server.inject({ method: 'POST', url: invitationUrl, headers })).statusCode).toBe(
      429,
    );
  });
  it('exposes liveness and OpenAPI without requiring a database', async () => {
    const server = await app();
    expect((await server.inject('/v1/health')).json()).toMatchObject({
      status: 'ok',
      service: 'forma-api',
    });
    expect(server.swagger().paths).toHaveProperty('/v1/auth/login');
  });
  it('rejects writes without signed CSRF and foreign origins', async () => {
    const server = await app();
    const missing = await server.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'a@b.test', password: 'a' },
    });
    expect(missing.statusCode).toBe(403);
    const csrf = await server.inject('/v1/security/csrf');
    const origin = await server.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: {
        origin: 'https://foreign.test',
        cookie: csrf.headers['set-cookie'],
        'x-csrf-token': csrf.json().token,
      },
      payload: { email: 'a@b.test', password: 'a' },
    });
    expect(origin.json().code).toBe('INVALID_ORIGIN');
  });
  it('returns no user without a session and a safe readiness failure', async () => {
    const server = await app();
    expect((await server.inject('/v1/auth/me')).statusCode).toBe(401);
    const ready = await server.inject('/v1/ready');
    expect(ready.statusCode).toBe(503);
    expect(ready.body).not.toContain('postgres');
  });
});
