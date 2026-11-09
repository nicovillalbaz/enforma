import 'dotenv/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  createHash,
  randomUUID,
} from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  stat,
  open,
  appendFile,
  rename,
  copyFile,
  lstat,
  rm,
} from 'node:fs/promises';
import { resolve, join, basename, sep, normalize } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { backupIdentity } from './backup-identity.js';

const headerMagic = Buffer.from('FORMA1');
const pgBin =
  process.env.PG_BIN ??
  (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/16/bin' : '/usr/bin');
const pgCommand = (name: string) =>
  join(pgBin, name + (process.platform === 'win32' ? '.exe' : ''));
function pgEnvironment(connectionString: string) {
  const uri = new URL(connectionString);
  return {
    ...process.env,
    PGHOST: uri.hostname,
    PGPORT: uri.port || '5432',
    PGUSER: decodeURIComponent(uri.username),
    PGPASSWORD: decodeURIComponent(uri.password),
    PGDATABASE: uri.pathname.slice(1),
  };
}
async function command(executable: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  await new Promise<void>((done, reject) => {
    const child = spawn(executable, args, {
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? done() : reject(new Error(`${basename(executable)} failed`)),
    );
  });
}
async function hashes(root: string, prefix = ''): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const key = join(prefix, entry.name);
    if (entry.isSymbolicLink())
      throw new Error('Symlinks are not supported in private storage backups');
    if (entry.isDirectory()) Object.assign(result, await hashes(root, key));
    else {
      const digest = createHash('sha256');
      for await (const chunk of createReadStream(join(root, key))) digest.update(chunk);
      result[key] = digest.digest('hex');
    }
  }
  return result;
}
async function privateReferences(client: pg.Client | pg.PoolClient): Promise<string[]> {
  const available = await client.query(
    "SELECT to_regprocedure('app.media_storage_references()') IS NOT NULL present",
  );
  if (!available.rows[0].present) return [];
  return (
    await client.query<{ key: string | null }>('SELECT app.media_storage_references() key')
  ).rows.flatMap((row) => (row.key ? [normalize(row.key)] : []));
}
async function databaseCounts(client: pg.Client | pg.PoolClient): Promise<Record<string, string>> {
  const counts = (
    await client.query<{ users: string; audit: string }>(
      'SELECT (SELECT count(*) FROM app_users)::text users,(SELECT count(*) FROM audit_logs)::text audit',
    )
  ).rows[0]!;
  if (
    (await client.query("SELECT to_regclass('public.coach_field_options') IS NOT NULL present"))
      .rows[0].present
  ) {
    Object.assign(counts, {
      coachFieldOptions: (await client.query('SELECT count(*)::text n FROM coach_field_options'))
        .rows[0].n,
    });
  }
  if (
    (
      await client.query(
        "SELECT to_regclass('public.anthropometry_assessments') IS NOT NULL present",
      )
    ).rows[0].present
  ) {
    Object.assign(counts, {
      anthropometryAssessments: (
        await client.query('SELECT count(*)::text n FROM anthropometry_assessments')
      ).rows[0].n,
    });
  }
  if (
    (await client.query("SELECT to_regclass('public.manual_coach_controls') IS NOT NULL present"))
      .rows[0].present
  ) {
    Object.assign(
      counts,
      (
        await client.query(
          `SELECT (SELECT count(*) FROM manual_coach_controls)::text "manualCoachControls",(SELECT count(*) FROM monthly_payment_marks)::text "monthlyPaymentMarks",(SELECT count(*) FROM manual_monthly_events)::text "manualMonthlyEvents",(SELECT coalesce(sum(monthly_price_pyg),0) FROM manual_coach_controls)::text "manualConfiguredPricePyg"`,
        )
      ).rows[0],
    );
  }
  if (
    (await client.query("SELECT to_regclass('public.coach_contracts') IS NOT NULL present")).rows[0]
      .present
  ) {
    Object.assign(
      counts,
      (
        await client.query(`SELECT
      (SELECT count(*) FROM coach_services)::text "coachServices",(SELECT count(*) FROM coach_contracts)::text "coachContracts",(SELECT count(*) FROM coach_charges)::text "coachCharges",(SELECT count(*) FROM coach_adjustments)::text "coachAdjustments",(SELECT count(*) FROM coach_payments)::text "coachPayments",(SELECT count(*) FROM coach_refunds)::text "coachRefunds",(SELECT count(*) FROM coach_session_entries)::text "coachSessionEntries",(SELECT count(*) FROM coach_prospects)::text "coachProspects",(SELECT count(*) FROM coach_prospect_events)::text "coachProspectEvents",(SELECT count(*) FROM coach_commands)::text "coachCommands"`)
      ).rows[0],
    );
    for (const currency of ['PYG', 'USD', 'EUR']) {
      const sums = (
        await client.query(
          `SELECT
        (SELECT coalesce(sum(total_minor),0)::text FROM coach_contracts WHERE currency=$1) contracts,
        (SELECT coalesce(sum(a.amount_minor),0)::text FROM coach_adjustments a JOIN coach_charges h ON h.id=a.charge_id JOIN coach_contracts c ON c.id=h.contract_id WHERE c.currency=$1) adjustments,
        (SELECT coalesce(sum(p.amount_minor),0)::text FROM coach_payments p JOIN coach_charges h ON h.id=p.charge_id JOIN coach_contracts c ON c.id=h.contract_id WHERE c.currency=$1) payments,
        (SELECT coalesce(sum(r.amount_minor),0)::text FROM coach_refunds r JOIN coach_payments p ON p.id=r.payment_id JOIN coach_charges h ON h.id=p.charge_id JOIN coach_contracts c ON c.id=h.contract_id WHERE c.currency=$1) returns`,
          [currency],
        )
      ).rows[0];
      for (const [name, value] of Object.entries(sums))
        Object.assign(counts, { [`coach${currency}${name}`]: value });
    }
  }
  if (
    (await client.query("SELECT to_regclass('public.agenda_events') IS NOT NULL present")).rows[0]
      .present
  ) {
    Object.assign(
      counts,
      (
        await client.query(
          'SELECT (SELECT count(*) FROM agenda_availability)::text "agendaAvailability",(SELECT count(*) FROM agenda_events)::text "agendaEvents",(SELECT count(*) FROM agenda_bookings)::text "agendaBookings",(SELECT count(*) FROM agenda_commands)::text "agendaCommands",(SELECT count(*) FROM agenda_rules)::text "agendaRules",(SELECT count(*) FROM agenda_rule_versions)::text "agendaRuleVersions",(SELECT count(*) FROM agenda_outbox)::text "agendaOutbox",(SELECT count(*) FROM agenda_runs)::text "agendaRuns",(SELECT count(*) FROM agenda_notifications)::text "agendaNotifications",(SELECT count(*) FROM agenda_preferences)::text "agendaPreferences"',
        )
      ).rows[0],
    );
  }
  if (
    (await client.query("SELECT to_regclass('public.followup_threads') IS NOT NULL present"))
      .rows[0].present
  ) {
    Object.assign(
      counts,
      (
        await client.query(
          'SELECT (SELECT count(*) FROM followup_threads)::text "followupThreads",(SELECT count(*) FROM followup_reads)::text "followupReads",(SELECT count(*) FROM followup_messages)::text "followupMessages",(SELECT count(*) FROM followup_attachments)::text "followupAttachments",(SELECT count(*) FROM followup_notification_preferences)::text "followupNotificationPreferences",(SELECT count(*) FROM followup_notifications)::text "followupNotifications",(SELECT count(*) FROM followup_habits)::text "followupHabits",(SELECT count(*) FROM followup_habit_entries)::text "followupHabitEntries",(SELECT count(*) FROM followup_checkin_templates)::text "followupCheckinTemplates",(SELECT count(*) FROM followup_checkin_versions)::text "followupCheckinVersions",(SELECT count(*) FROM followup_checkin_schedules)::text "followupCheckinSchedules",(SELECT count(*) FROM followup_checkin_tasks)::text "followupCheckinTasks",(SELECT count(*) FROM followup_checkin_responses)::text "followupCheckinResponses"',
        )
      ).rows[0],
    );
  }
  if (
    (await client.query("SELECT to_regclass('public.nutrition_items') IS NOT NULL present")).rows[0]
      .present
  ) {
    Object.assign(
      counts,
      (
        await client.query(
          'SELECT (SELECT count(*) FROM nutrition_professionals)::text nutritionProfessionals,(SELECT count(*) FROM nutrition_items)::text nutritionItems,(SELECT count(*) FROM nutrition_versions)::text nutritionVersions,(SELECT count(*) FROM nutrition_assignments)::text nutritionAssignments,(SELECT count(*) FROM nutrition_preferences)::text nutritionPreferences,(SELECT count(*) FROM nutrition_sharing)::text nutritionSharing,(SELECT count(*) FROM nutrition_entries)::text nutritionEntries,(SELECT count(*) FROM nutrition_comments)::text nutritionComments,(SELECT count(*) FROM nutrition_photos)::text nutritionPhotos',
        )
      ).rows[0],
    );
  }
  if (
    (await client.query("SELECT to_regclass('public.private_resources') IS NOT NULL present"))
      .rows[0].present
  ) {
    Object.assign(
      counts,
      (
        await client.query(
          'SELECT (SELECT count(*) FROM resource_collections)::text resourceCollections,(SELECT count(*) FROM private_resources)::text resources,(SELECT count(*) FROM resource_versions)::text resourceVersions,(SELECT count(*) FROM resource_student_access)::text resourceGrants',
        )
      ).rows[0],
    );
  }
  if (
    (await client.query("SELECT to_regclass('public.program_versions') IS NOT NULL present"))
      .rows[0].present
  ) {
    const programs = (
      await client.query(
        'SELECT (SELECT count(*) FROM training_programs)::text programs,(SELECT count(*) FROM program_versions)::text versions,(SELECT count(*) FROM program_assignments)::text assignments',
      )
    ).rows[0];
    if (
      (await client.query("SELECT to_regclass('public.workout_sessions') IS NOT NULL present"))
        .rows[0].present
    ) {
      const workouts = (
        await client.query(
          'SELECT (SELECT count(*) FROM workout_sessions)::text sessions,(SELECT count(*) FROM workout_sets)::text sets,(SELECT count(*) FROM workout_events)::text events',
        )
      ).rows[0];
      if (
        (await client.query("SELECT to_regclass('public.body_measurements') IS NOT NULL present"))
          .rows[0].present
      ) {
        const progress = (
          await client.query(
            'SELECT (SELECT count(*) FROM body_measurements)::text measurements,(SELECT count(*) FROM progress_photos)::text photos,(SELECT count(*) FROM progress_preferences)::text privacy,(SELECT count(*) FROM progress_sharing)::text sharing,(SELECT count(*) FROM progress_alert_settings)::text alerts',
          )
        ).rows[0];
        if (
          (await client.query("SELECT to_regclass('public.saas_invoices') IS NOT NULL present"))
            .rows[0].present
        ) {
          const billing = (
            await client.query(
              'SELECT (SELECT count(*) FROM saas_billing_enrollments)::text billingEnrollments,(SELECT count(*) FROM saas_invoices)::text invoices,(SELECT count(*) FROM saas_adjustments)::text adjustments,(SELECT count(*) FROM saas_payments)::text payments,(SELECT count(*) FROM saas_payment_reversals)::text reversals,(SELECT count(*) FROM platform_audit_logs)::text platformAudit,(SELECT count(*) FROM saas_subscription_events)::text subscriptionEvents,(SELECT coalesce(sum(total_pyg),0) FROM saas_invoices)::text billedPyg,(SELECT coalesce(sum(amount_pyg),0) FROM saas_payments)::text paymentsPyg,(SELECT coalesce(sum(amount_pyg),0) FROM saas_adjustments)::text adjustmentsPyg',
            )
          ).rows[0];
          return { ...counts, ...programs, ...workouts, ...progress, ...billing };
        }
        return { ...counts, ...programs, ...workouts, ...progress };
      }
      return { ...counts, ...programs, ...workouts };
    }
    return { ...counts, ...programs };
  }
  return counts;
}
async function snapshotStorage(source: string, destination: string) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink())
      throw new Error('Symlinks are not supported in private storage backups');
    if (entry.name.endsWith('.pending')) continue;
    if (entry.isDirectory())
      await snapshotStorage(join(source, entry.name), join(destination, entry.name));
    else if (entry.isFile())
      await copyFile(join(source, entry.name), join(destination, entry.name)).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
  }
}
async function removeOwnedTemporary(path: string) {
  const root = resolve('.local'),
    target = resolve(path);
  if (
    !target.startsWith(`${root}${sep}`) ||
    !/^(backup|restore)-[a-f0-9-]{36}$/.test(basename(target))
  )
    throw new Error('Unexpected backup temporary directory');
  if ((await lstat(target)).isSymbolicLink()) throw new Error('Unexpected backup symlink');
  await rm(target, { recursive: true, force: true });
}
interface BackupOptions {
  connectionString?: string;
  storageRoot?: string;
}
export async function createBackup(options: BackupOptions = {}) {
  const snapshotStartedAt = new Date().toISOString();
  const pass = process.env.BACKUP_PASSPHRASE;
  const connection = options.connectionString ?? process.env.DATABASE_ADMIN_URL;
  if (!pass || pass.length < 20 || !connection)
    throw new Error(
      'Database credentials and a backup passphrase of at least 20 characters are required',
    );
  const id = randomUUID();
  const temporary = resolve('.local', `backup-${id}`);
  const storage = resolve(options.storageRoot ?? process.env.STORAGE_PATH ?? '.local/storage');
  if (!/^[a-zA-Z0-9_-]+$/.test(basename(storage)))
    throw new Error('Storage directory must have a portable name');
  await mkdir(temporary, { recursive: true });
  await mkdir(storage, { recursive: true });
  try {
    const pool = new pg.Pool({ connectionString: connection });
    const client = await pool.connect();
    let counts: Record<string, string>;
    let requiredFiles: string[];
    const snapshot = join(temporary, basename(storage));
    try {
      await client.query('SELECT pg_advisory_lock_shared(70321021)');
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const snapshotId = (
        await client.query<{ snapshot: string }>('SELECT pg_export_snapshot() snapshot')
      ).rows[0]!.snapshot;
      counts = await databaseCounts(client);
      requiredFiles = await privateReferences(client);
      await command(
        pgCommand('pg_dump'),
        ['--format=custom', '--snapshot', snapshotId, '--file', join(temporary, 'database.dump')],
        pgEnvironment(connection),
      );
      await snapshotStorage(storage, snapshot);
      const copied = await hashes(snapshot);
      if (requiredFiles.some((key) => !copied[key]))
        throw new Error('A database-referenced private file is missing from backup storage');
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.query('SELECT pg_advisory_unlock_shared(70321021)');
      client.release();
      await pool.end();
    }
    const manifest = {
      version: 2,
      createdAt: new Date().toISOString(),
      counts,
      storageName: basename(storage),
      requiredFiles,
      files: await hashes(snapshot),
    };
    await writeFile(join(temporary, 'manifest.json'), JSON.stringify(manifest));
    const destination = resolve(process.env.BACKUP_PATH ?? '.local/backups');
    await mkdir(destination, { recursive: true });
    const output = join(
      destination,
      `forma-${new Date().toISOString().replaceAll(':', '-')}-${id}.enc`,
    );
    const salt = randomBytes(16),
      iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', scryptSync(pass, salt, 32), iv);
    await writeFile(`${output}.pending`, Buffer.concat([headerMagic, salt, iv]), {
      flag: 'wx',
      mode: 0o600,
    });
    const tar = spawn(
      'tar',
      ['-cf', '-', '-C', temporary, 'database.dump', 'manifest.json', basename(storage)],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    const completed = new Promise<void>((done, reject) => {
      tar.on('error', reject);
      tar.on('exit', (code) =>
        code === 0 ? done() : reject(new Error('Archive creation failed')),
      );
    });
    await Promise.all([
      pipeline(tar.stdout, cipher, createWriteStream(`${output}.pending`, { flags: 'a' })),
      completed,
    ]);
    await appendFile(`${output}.pending`, cipher.getAuthTag());
    await rename(`${output}.pending`, output);
    await writeFile(
      output + '.meta.json',
      JSON.stringify({
        version: 1,
        createdAt: snapshotStartedAt,
        completedAt: new Date().toISOString(),
        ...backupIdentity(connection, storage),
        bytes: (await stat(output)).size,
      }),
      { flag: 'wx', mode: 0o600 },
    );
    return output;
  } finally {
    await removeOwnedTemporary(temporary);
  }
}
export async function restoreDrill(backup: string, options: BackupOptions = {}) {
  const pass = process.env.BACKUP_PASSPHRASE;
  const connection = options.connectionString ?? process.env.DATABASE_ADMIN_URL;
  if (!pass || !connection) throw new Error('Restore configuration is missing');
  const temporary = resolve('.local', `restore-${randomUUID()}`);
  await mkdir(temporary, { recursive: true });
  try {
    const source = await open(backup, 'r');
    const header = Buffer.alloc(34);
    const tag = Buffer.alloc(16);
    const size = (await stat(backup)).size;
    try {
      await source.read(header, 0, 34, 0);
      await source.read(tag, 0, 16, size - 16);
    } finally {
      await source.close();
    }
    if (!header.subarray(0, 6).equals(headerMagic)) throw new Error('Invalid backup format');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      scryptSync(pass, header.subarray(6, 22), 32),
      header.subarray(22, 34),
    );
    decipher.setAuthTag(tag);
    const archive = join(temporary, 'archive.tar');
    await pipeline(
      createReadStream(backup, { start: 34, end: size - 17 }),
      decipher,
      createWriteStream(archive, { flags: 'wx', mode: 0o600 }),
    );
    await command('tar', ['-xf', archive, '-C', temporary]);
    const manifest = JSON.parse(await readFile(join(temporary, 'manifest.json'), 'utf8')) as {
      counts: Record<string, string>;
      storageName: string;
      files: Record<string, string>;
      requiredFiles?: string[];
    };
    const restoredFiles = await hashes(join(temporary, manifest.storageName));
    let financialBalancesChecked = 0;
    if (JSON.stringify(restoredFiles) !== JSON.stringify(manifest.files))
      throw new Error('Restored media hashes do not match');
    const dbName = `forma_restore_${randomUUID().replaceAll('-', '')}`;
    if (!/^forma_restore_[a-f0-9]{32}$/.test(dbName))
      throw new Error('Invalid isolated restore database');
    const adminUri = new URL(connection);
    adminUri.pathname = '/postgres';
    const admin = new pg.Client({ connectionString: adminUri.toString() });
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE ${dbName}`);
      const restoreUri = new URL(connection);
      restoreUri.pathname = `/${dbName}`;
      await command(
        pgCommand('pg_restore'),
        ['--exit-on-error', '--dbname', dbName, join(temporary, 'database.dump')],
        pgEnvironment(restoreUri.toString()),
      );
      const restored = new pg.Client({ connectionString: restoreUri.toString() });
      await restored.connect();
      try {
        const counts = await databaseCounts(restored);
        if (Object.entries(manifest.counts).some(([key, value]) => counts[key] !== value))
          throw new Error('Restored database counts do not match');
        const required = await privateReferences(restored);
        if (required.some((key) => !restoredFiles[key]))
          throw new Error('A restored database reference has no private file');
        if (
          (await restored.query("SELECT to_regclass('public.saas_invoices') IS NOT NULL present"))
            .rows[0].present
        ) {
          const invoices = (
            await restored.query(
              'SELECT i.id,i.organization_id,i.total_pyg+coalesce((SELECT sum(amount_pyg) FROM saas_adjustments a WHERE a.invoice_id=i.id),0)-coalesce((SELECT sum(amount_pyg) FROM saas_payments p WHERE p.invoice_id=i.id AND NOT EXISTS(SELECT 1 FROM saas_payment_reversals r WHERE r.payment_id=p.id)),0) expected_balance FROM saas_invoices i',
            )
          ).rows;
          if (invoices.length) {
            const actor = (
              await restored.query(
                "SELECT id FROM app_users WHERE status='active' AND is_superadmin ORDER BY id LIMIT 1",
              )
            ).rows[0];
            if (!actor)
              throw new Error(
                'An active platform administrator is required to verify restored accounts',
              );
            for (const invoice of invoices) {
              await restored.query(
                "SELECT set_config('app.user_id',$1,false),set_config('app.organization_id',$2,false)",
                [actor.id, invoice.organization_id],
              );
              const value = (
                await restored.query('SELECT app.billing_balance($1)::text balance', [invoice.id])
              ).rows[0].balance;
              if (value === null || value !== String(invoice.expected_balance) || Number(value) < 0)
                throw new Error('Restored account balance or authorized access mismatch');
              financialBalancesChecked++;
            }
          }
        }
      } finally {
        await restored.end();
      }
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
      await admin.end();
    }
    return {
      database: 'verified',
      media: Object.keys(restoredFiles).length,
      privateReferences: 'verified',
      recordCounts: Object.keys(manifest.counts).length,
      financialBalancesChecked,
      isolated: true,
    };
  } finally {
    await removeOwnedTemporary(temporary);
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    if (process.argv[2] === 'verify' && process.argv[3])
      console.info(await restoreDrill(resolve(process.argv[3])));
    else console.info(`Encrypted backup ready: ${await createBackup()}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Backup failed');
    process.exitCode = 1;
  }
}
