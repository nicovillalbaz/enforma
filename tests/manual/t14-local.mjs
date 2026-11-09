// Opt-in bounded read pass over existing synthetic data, no browser or domain writes.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import pg from 'pg';
import { buildApp } from '../../apps/api/src/app.ts';
assert.equal(process.env.FORMA_T14_LOCAL_QA, '1');
const boundariesOnly = process.env.FORMA_T14_BOUNDARIES_ONLY === '1';
const url = new URL(process.env.DATABASE_ADMIN_URL);
assert(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/forma');
const fixture = JSON.parse(await readFile('.local/t09-visual-fixture.json', 'utf8'));
assert(fixture.email.endsWith('@example.test') && fixture.pupilEmail.endsWith('@example.test'));
const report = {
  version: '0.14.0',
  scope: 'local-injection-synthetic-data',
  browserInstances: 0,
  domainMutations: 0,
  pdfGenerations: 0,
  requests: 0,
  samplesPerRoute: boundariesOnly ? 0 : 3,
  routes: [],
  boundaries: [],
  limitations:
    'In-process API injection: no TCP/TLS/proxy, browser render, mobile network, load or p95. Login/logout write only technical session/audit state.',
};
const start = performance.now();
let server;
const sessions = [];
const admin = new pg.Client({
  connectionString: process.env.DATABASE_ADMIN_URL,
  connectionTimeoutMillis: 3000,
  statement_timeout: 5000,
  options: '-c default_transaction_read_only=on',
});
function client(address) {
  const jar = new Map();
  let csrf;
  return {
    async call(method, path, payload) {
      assert(performance.now() - start < 30000, '30 second request budget exceeded');
      report.requests++;
      const response = await server.inject({
        method,
        url: path,
        remoteAddress: address,
        headers: {
          cookie: [...jar.values()].join('; '),
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        ...(payload ? { payload } : {}),
      });
      const raw = response.headers['set-cookie'];
      for (const cookie of raw ? (Array.isArray(raw) ? raw : [raw]) : []) {
        const pair = cookie.split(';')[0];
        jar.set(pair.split('=')[0], pair);
      }
      if (path === '/v1/security/csrf') csrf = response.json().token;
      return response;
    },
  };
}
async function login(email, address) {
  const http = client(address);
  sessions.push(http);
  assert.equal((await http.call('GET', '/v1/security/csrf')).statusCode, 200);
  assert.equal(
    (await http.call('POST', '/v1/auth/login', { email, password: fixture.password })).statusCode,
    200,
  );
  // Login rotates the signed CSRF cookie. Fetch its matching token before logout.
  assert.equal((await http.call('GET', '/v1/security/csrf')).statusCode, 200);
  return http;
}
try {
  await admin.connect();
  const other = (
    await admin.query(
      "SELECT id FROM organizations WHERE id<>$1 AND kind='coach' AND status IN ('active','trial') LIMIT 1",
      [fixture.orgId],
    )
  ).rows[0];
  assert(other, 'Need an existing different synthetic space; do not create one automatically');
  server = await buildApp({
    origin: 'http://127.0.0.1:5184',
    cookieSecret: process.env.COOKIE_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    storageRoot: process.env.STORAGE_PATH,
  });
  const owner = await login(fixture.email, '127.0.14.1');
  const pupil = boundariesOnly ? null : await login(fixture.pupilEmail, '127.0.14.2');
  const root = `/v1/organizations/${fixture.orgId}`;
  const routes = boundariesOnly
    ? []
    : ['/coach-start', '/students', '/programs?limit=20', '/agenda', '/commerce'];
  for (const route of routes) {
    const times = [];
    let bytes;
    for (let sample = 0; sample < 3; sample++) {
      const before = performance.now();
      const response = await owner.call('GET', root + route);
      times.push(Math.round((performance.now() - before) * 100) / 100);
      assert.equal(response.statusCode, 200, `Unexpected status at ${route}`);
      assert.equal(response.headers['cache-control'], 'no-store');
      bytes = Buffer.byteLength(response.payload);
    }
    const sorted = [...times].sort((a, b) => a - b);
    report.routes.push({
      route: '/v1/organizations/:id' + route,
      samplesMs: times,
      minMs: sorted[0],
      medianMs: sorted[1],
      maxMs: sorted[2],
      lastResponseBytes: bytes,
    });
  }
  const boundaries = pupil
    ? [
        [pupil, root + '/coach-start', 'pupil denied owner overview', 403],
        [
          pupil,
          root + '/commerce/reports?from=2026-10-01&to=2026-10-31',
          'pupil denied business reports',
          403,
        ],
      ]
    : [];
  boundaries.push([
    owner,
    `/v1/organizations/${other.id}/coach-start`,
    'owner denied existing other space',
    404,
  ]);
  for (const [http, path, label, expected] of boundaries) {
    const response = await http.call('GET', path);
    report.currentCase = { label, status: response.statusCode, expected };
    assert.equal(response.statusCode, expected, label);
    assert.equal(response.headers['cache-control'], 'no-store');
    report.boundaries.push({ label, status: response.statusCode });
  }
  const publicClient = client('127.0.14.3');
  assert.equal((await publicClient.call('GET', root + '/coach-start')).statusCode, 401);
  report.boundaries.push({ label: 'no session denied owner overview', status: 401 });
  report.status = 'passed';
  delete report.currentCase;
} catch {
  report.status = 'failed';
  report.message =
    'Local pass failed; inspect the case locally without publishing content/credentials.';
  process.exitCode = 1;
} finally {
  report.logoutStatuses = [];
  if (server) {
    for (const http of sessions) {
      try {
        const response = await http.call('POST', '/v1/auth/logout');
        report.logoutStatuses.push(response.statusCode);
        if (response.statusCode !== 200) {
          report.status = 'failed';
          process.exitCode = 1;
        }
      } catch {
        report.status = 'failed';
        process.exitCode = 1;
      }
    }
    await server.close();
  }
  await admin.end();
  report.durationMs = Math.round(performance.now() - start);
  await writeFile(
    boundariesOnly
      ? 'docs/evidencias/t14-accesos-continuacion.json'
      : 'docs/evidencias/t14-local.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
}
