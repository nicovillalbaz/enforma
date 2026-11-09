// Read-only, bounded local preparation check. It cannot approve a real pilot.
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { product } from '@forma/shared';
import { runtimeConfigIssues } from '../apps/api/src/runtime-config.js';
import { inspectWebRelease } from './web-release.js';

const args = process.argv.slice(2);
if (args.some((arg) => !['--database', '--evidence'].includes(arg)))
  throw new Error('Uso: release:check [--database] [--evidence]');
const checks: Record<string, boolean | null> = {
  node24: Number(process.versions.node.split('.')[0]) >= 24,
};
const notes: string[] = [];
let report: Record<string, unknown>;
try {
  const configIssues = runtimeConfigIssues({
    production: true,
    origin: process.env.APP_ORIGIN ?? '',
    cookieSecret: process.env.COOKIE_SECRET ?? '',
    databaseUrl: process.env.DATABASE_URL,
    trustedProxyIp: process.env.TRUSTED_PROXY_IP,
  });
  notes.push(...configIssues);
  checks.productionConfig = notes.length === 0;
  const manifests = ['package.json'];
  for (const root of ['apps', 'packages'])
    for (const name of await readdir(root)) manifests.push(join(root, name, 'package.json'));
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  checks.versions = lock.version === product.version;
  for (const file of manifests) {
    const manifest = JSON.parse(await readFile(file, 'utf8'));
    const key =
      file === 'package.json' ? '' : file.replaceAll('\\', '/').replace('/package.json', '');
    if (manifest.version !== product.version || lock.packages[key]?.version !== product.version)
      checks.versions = false;
    for (const [name, version] of Object.entries(manifest.dependencies ?? {}))
      if (
        name.startsWith('@forma/') &&
        (version !== product.version ||
          lock.packages[key]?.dependencies?.[name] !== product.version)
      )
        checks.versions = false;
  }
  const migrationRoot = 'packages/db/migrations';
  const migrationManifest: { name: string; checksum: string }[] = [];
  for (const name of (await readdir(migrationRoot)).filter((name) => name.endsWith('.sql')).sort())
    migrationManifest.push({
      name,
      checksum: createHash('sha256')
        .update(await readFile(join(migrationRoot, name)))
        .digest('hex'),
    });
  const migrationDigest = createHash('sha256')
    .update(JSON.stringify(migrationManifest))
    .digest('hex');
  checks.appliedMigrations = null;
  checks.apiRole = null;
  if (args.includes('--database')) {
    // No default database fallback; no migrations, DDL, fixtures or business data reads.
    if (!process.env.DATABASE_ADMIN_URL || !process.env.DATABASE_URL)
      throw new Error('database configuration missing');
    const clients = [process.env.DATABASE_ADMIN_URL, process.env.DATABASE_URL].map(
      (connectionString) =>
        new pg.Client({
          connectionString,
          connectionTimeoutMillis: 3000,
          statement_timeout: 5000,
          options: '-c default_transaction_read_only=on',
        }),
    );
    try {
      await clients[0]!.connect();
      const applied = (
        await clients[0]!.query('SELECT name,checksum FROM schema_migrations ORDER BY name')
      ).rows;
      checks.appliedMigrations = JSON.stringify(applied) === JSON.stringify(migrationManifest);
      await clients[1]!.connect();
      const role = (
        await clients[1]!.query(`SELECT current_user='forma_api' expected_role,
        NOT EXISTS(SELECT 1 FROM pg_roles WHERE pg_has_role(current_user,oid,'MEMBER')
          AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) restricted`)
      ).rows[0];
      checks.apiRole = role.expected_role && role.restricted;
    } finally {
      await Promise.allSettled(clients.map((client) => client.end()));
    }
  }
  let webBuild: Record<string, unknown> | null = null;
  const provenance = await inspectWebRelease();
  checks.webBuildCurrent = provenance.status === 'verified';
  try {
    const html = await readFile('dist/web/index.html', 'utf8');
    const entryFiles = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(
      (match) => match[1]!,
    );
    webBuild = {
      entryFiles: await Promise.all(
        entryFiles.map(async (path) => ({ path, bytes: (await stat('dist/web' + path)).size })),
      ),
      provenance,
    };
    checks.webBuildPresent = entryFiles.length > 0 && (await stat('dist/web/sw.js')).isFile();
  } catch {
    checks.webBuildPresent = false;
  }
  report = {
    checkedAt: new Date().toISOString(),
    version: product.version,
    scope: 'independent-coaches-local-preparation',
    status: Object.values(checks).some((value) => value === false)
      ? 'needs-attention'
      : 'local-checks-passed',
    checks,
    notes,
    manifestCount: manifests.length,
    migrationCount: migrationManifest.length,
    migrationDigest,
    nextMigration: String(migrationManifest.length + 1).padStart(3, '0'),
    webBuild,
    databaseCheckRequested: args.includes('--database'),
    pilotApproved: false,
    externalGates: 'docs/piloto/00-puertas.md',
    limitations: [
      'No prueba DNS/TLS, correo, antivirus, Docker, teléfonos, recuperación externa, capacidad ni aprobación comercial.',
      'Un rol restringido no demuestra todos los permisos RLS/IDOR; conservar evidencias de integración.',
      'Las huellas comparan fuentes web y artefactos locales con el manifiesto del build; no certifican el entorno, node_modules o autenticidad del constructor. API/worker tienen su propio inventario y no forman parte de esa huella web.',
    ],
  };
  if (Object.values(checks).some((value) => value === false)) process.exitCode = 1;
} catch {
  // pg errors can contain endpoints, paths or credentials; never serialize them.
  report = {
    checkedAt: new Date().toISOString(),
    version: product.version,
    status: 'failed',
    checks,
    message:
      'No se pudo completar el inventario. Revisar acceso/configuración local sin publicar secretos.',
    pilotApproved: false,
  };
  process.exitCode = 1;
}
if (args.includes('--evidence'))
  await writeFile('docs/evidencias/t14-preparacion.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
