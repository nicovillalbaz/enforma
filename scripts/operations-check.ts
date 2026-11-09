import 'dotenv/config';
import pg from 'pg';
import { statfs, stat, readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { backupIdentity } from './backup-identity.js';
if (!process.env.DATABASE_ADMIN_URL) throw new Error('DATABASE_ADMIN_URL is required');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_ADMIN_URL,
  max: 1,
  connectionTimeoutMillis: 3000,
  statement_timeout: 5000,
  options: '-c default_transaction_read_only=on',
});
try {
  const storage = resolve(process.env.STORAGE_PATH ?? '.local/storage'),
    disk = await statfs(storage),
    free = disk.bavail * disk.bsize,
    total = disk.blocks * disk.bsize;
  const documents = (
    await pool.query(
      "SELECT ((SELECT coalesce(sum(greatest(reserved_bytes,byte_size)),0) FROM resource_versions WHERE kind<>'media')+(SELECT coalesce(sum(byte_size),0) FROM nutrition_photos))::text bytes",
    )
  ).rows[0];
  const documentWorker = (
    await pool.query(
      "SELECT EXISTS(SELECT 1 FROM document_worker_heartbeats WHERE heartbeat_at>now()-interval '45 seconds' AND renderer_available) online",
    )
  ).rows[0].online;
  const db = (
    await pool.query(
      "SELECT pg_database_size(current_database())::text bytes,(SELECT count(*) FROM jobs WHERE status='failed') failed_jobs,(SELECT count(*) FROM jobs WHERE ((status='ready' AND available_at<now()-interval '15 minutes') OR (status='running' AND leased_until<now()))) delayed_jobs,(SELECT count(*) FROM media_worker_heartbeats WHERE available AND heartbeat_at>now()-interval '30 seconds') workers",
    )
  ).rows[0];
  const usage = (
    await pool.query(
      "SELECT (SELECT coalesce(sum(greatest(reserved_bytes,input_bytes+output_bytes+poster_bytes)),0) FROM media_assets)::text media_bytes,(SELECT coalesce(sum(byte_size),0) FROM progress_photos)::text photo_bytes,(SELECT coalesce(sum(byte_size),0) FROM organization_logo_assets)::text logo_bytes,(SELECT coalesce(sum(receipt_bytes),0) FROM saas_payments)::text receipt_bytes,(SELECT coalesce(sum(receipt_bytes),0) FROM coach_payments)::text coach_receipt_bytes,(SELECT count(*) FROM students WHERE status='active') enabled_students",
    )
  ).rows[0];
  const backupRoot = resolve(process.env.BACKUP_PATH ?? '.local/backups'),
    files = await readdir(backupRoot).catch(() => []),
    backups = await Promise.all(
      files
        .filter((n) => /^forma-[\w.-]+\.enc$/.test(n))
        .map(async (n) => {
          try {
            const path = join(backupRoot, n),
              meta = JSON.parse(await readFile(path + '.meta.json', 'utf8')) as {
                version: number;
                database: string;
                storage: string;
                bytes: number;
                createdAt: string;
              },
              identity = backupIdentity(process.env.DATABASE_ADMIN_URL!, storage),
              info = await stat(path);
            return meta.version === 1 &&
              meta.database === identity.database &&
              meta.storage === identity.storage &&
              meta.bytes === info.size &&
              Number.isFinite(Date.parse(meta.createdAt))
              ? { name: n, modified: Date.parse(meta.createdAt) }
              : null;
          } catch {
            return null;
          }
        }),
    ),
    latest = backups.filter((b) => b !== null).sort((a, b) => b.modified - a.modified)[0],
    backupAgeHours = latest ? (Date.now() - latest.modified) / 3600000 : null;
  const stored =
      Number(usage.media_bytes) +
      Number(usage.photo_bytes) +
      Number(usage.logo_bytes) +
      Number(usage.receipt_bytes) +
      Number(usage.coach_receipt_bytes) +
      Number(documents.bytes),
    per100 =
      Number(usage.enabled_students) > 0
        ? Math.ceil((stored / Number(usage.enabled_students)) * 100)
        : null;
  const moneyInput = (key: string) => {
      const s = process.env[key];
      if (s === undefined || s === '') return null;
      const v = Number(s);
      if (!Number.isFinite(v) || v < 0) throw new Error('Invalid cost input: ' + key);
      return v;
    },
    vps = moneyInput('COST_VPS_MONTHLY_PYG'),
    backup = moneyInput('COST_BACKUP_MONTHLY_PYG'),
    support = moneyInput('COST_SUPPORT_100_MONTHLY_PYG');
  const followupWorker = (
    await pool.query(
      "SELECT EXISTS(SELECT 1 FROM followup_worker_state WHERE heartbeat_at>now()-interval '3 minutes') online",
    )
  ).rows[0].online;
  const agendaWorker = (
    await pool.query(
      "SELECT EXISTS(SELECT 1 FROM agenda_worker_state WHERE heartbeat_at>now()-interval '3 minutes') online",
    )
  ).rows[0].online;
  const internalNotices = (
    await pool.query(
      "SELECT count(*)FILTER(WHERE status='scheduled')::int scheduled,count(*)FILTER(WHERE status='failed')::int failed FROM agenda_runs",
    )
  ).rows[0];
  const checks = {
    agendaWorker,
    followupWorker,
    database: true,
    disk: free >= Math.max(2 * 1024 ** 3, total * 0.1),
    mediaWorker: Number(db.workers) > 0,
    documentWorker,
    queue: Number(db.delayed_jobs) === 0,
    localBackup: backupAgeHours !== null && backupAgeHours >= 0 && backupAgeHours <= 24,
  };
  const jobKinds = (
    await pool.query(
      "SELECT kind,count(*)::integer pending,count(*)FILTER(WHERE (status='ready' AND available_at<now()-interval '15 minutes') OR (status='running' AND leased_until<now()))::integer delayed FROM jobs WHERE status IN ('ready','running') GROUP BY kind ORDER BY kind",
    )
  ).rows;
  const report = {
    checkedAt: new Date().toISOString(),
    scope: 'local-only',
    checks,
    databaseBytes: Number(db.bytes),
    diskFreeBytes: free,
    diskTotalBytes: total,
    failedJobs: Number(db.failed_jobs),
    delayedJobs: Number(db.delayed_jobs),
    pendingByKind: jobKinds,
    internalNotices,
    workerCount: Number(db.workers),
    documentStorageBytes: Number(documents.bytes),
    coachReceiptStorageBytes: Number(usage.coach_receipt_bytes),
    storageBytes: stored,
    enabledStudents: Number(usage.enabled_students),
    estimatedStorage100Bytes: per100,
    backupAgeHours,
    externalBackupVerified: false,
    cost100: {
      vpsPyg: vps,
      backupPyg: backup,
      supportPyg: support,
      totalKnownPyg:
        vps !== null && backup !== null && support !== null ? vps + backup + support : null,
      excludes:
        'Dominio, impuestos, egreso, crecimiento de medios y costes no introducidos; no es una tarifa comercial.',
    },
  };
  console.log(JSON.stringify(report, null, 2));
  if (Object.values(checks).some((v) => !v)) process.exitCode = 1;
} catch (e) {
  console.error(
    JSON.stringify({
      scope: 'local-only',
      status: 'failed',
      message:
        e instanceof Error
          ? e.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]')
          : 'Operation check failed',
    }),
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
