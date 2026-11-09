import { afterEach, expect, it } from 'vitest';
import { buildApp } from '../../apps/api/src/app.js';
import { proxyTrust, runtimeConfigIssues } from '../../apps/api/src/runtime-config.js';
const instances: Awaited<ReturnType<typeof buildApp>>[] = [];
const base = {
  origin: 'https://forma.test',
  cookieSecret: 'random-production-secret-with-at-least-32-characters',
  production: true,
  databaseUrl: 'postgres://forma_api:private@127.0.0.1:1/none',
};
afterEach(async () => {
  await Promise.all(instances.splice(0).map((app) => app.close()));
});

it('rejects insecure production configuration before opening a pool, without echoing secrets', async () => {
  const invalid = {
    ...base,
    origin: 'http://forma.test',
    databaseUrl: 'postgres://forma_admin:do-not-leak@127.0.0.1/forma',
    cookieSecret: 'REPLACE_WITH_A_RANDOM_SECRET_MINIMUM_32_CHARACTERS',
  };
  const issues = runtimeConfigIssues(invalid).join('\n');
  expect(issues).toContain('APP_ORIGIN');
  expect(issues).toContain('DATABASE_URL');
  expect(issues).toContain('COOKIE_SECRET');
  expect(issues).not.toContain('do-not-leak');
  await expect(buildApp(invalid)).rejects.toThrow('APP_ORIGIN');
  expect(runtimeConfigIssues({ ...base, origin: base.origin + '/otra' }).join()).toContain(
    'APP_ORIGIN',
  );
  expect(runtimeConfigIssues({ ...base, databaseUrl: undefined }).join()).toContain('DATABASE_URL');
  expect(
    runtimeConfigIssues({ ...base, databaseUrl: 'postgres://other:secret@db/forma' }).join(),
  ).toContain('forma_api');
  expect(
    runtimeConfigIssues({ ...base, databaseUrl: 'postgres://forma_api@db/forma' }).join(),
  ).toContain('DATABASE_URL');
  expect(() => proxyTrust('true')).toThrow('TRUSTED_PROXY_IP');
});

it('keeps production cookies secure, responses private and development endpoints unavailable', async () => {
  const app = await buildApp(base);
  instances.push(app);
  const csrf = await app.inject('/v1/security/csrf');
  expect(csrf.headers['cache-control']).toBe('no-store');
  const cookie = String(csrf.headers['set-cookie']);
  expect(cookie).toMatch(/^__Host-forma_csrf=/);
  expect(cookie).toMatch(/; Secure/);
  expect(cookie).toMatch(/; HttpOnly/);
  expect(cookie).toMatch(/; SameSite=Strict/i);
  expect((await app.inject('/v1/docs')).statusCode).toBe(404);
  expect((await app.inject('/v1/auth/me')).statusCode).toBe(401);
});

it('uses only the nearest client behind one private proxy and ignores forwarded spoofing when direct', async () => {
  for (const trustedProxyIp of [undefined, '172.30.14.2']) {
    const app = await buildApp({ ...base, trustedProxyIp });
    instances.push(app);
    // Test-only route: never part of the application contract.
    app.get('/test-ip', async (request) => ({ ip: request.ip }));
    const response = await app.inject({
      url: '/test-ip',
      remoteAddress: '172.30.14.2',
      headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.7' },
    });
    expect(response.json().ip).toBe(trustedProxyIp ? '203.0.113.7' : '172.30.14.2');
    const direct = await app.inject({
      url: '/test-ip',
      remoteAddress: '203.0.113.8',
      headers: { 'x-forwarded-for': '198.51.100.1' },
    });
    expect(direct.json().ip).toBe('203.0.113.8');
  }
});
