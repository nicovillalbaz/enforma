import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import type { Pool } from 'pg';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type PrivacyScope = {
  organizationId: string;
  studentId: string;
  operatorId: string;
  requestId: string;
  ticket: string;
};
const studentTables = [
  'student_professionals',
  'student_billable_intervals',
  'exercise_student_access',
  'program_assignments',
  'workout_sessions',
  'progress_preferences',
  'progress_sharing',
  'body_measurements',
  'anthropometry_assessments',
  'progress_photos',
  'progress_alert_settings',
  'resource_collections',
  'resource_student_access',
  'nutrition_assignments',
  'nutrition_preferences',
  'nutrition_sharing',
  'nutrition_entries',
  'nutrition_comments',
  'nutrition_photos',
  'followup_threads',
  'agenda_bookings',
  'coach_contracts',
  'coach_prospects',
  'monthly_payment_marks',
  'manual_monthly_events',
] as const;
// Every subquery is bound to BOTH the tenant and the pupil. No graph traversal to other pupils.
const sessions = 'SELECT id FROM workout_sessions WHERE organization_id=$1 AND student_id=$2';
const threads = 'SELECT id FROM followup_threads WHERE organization_id=$1 AND student_id=$2';
const habits = `SELECT id FROM followup_habits WHERE organization_id=$1 AND thread_id IN (${threads})`;
const schedules = `SELECT id FROM followup_checkin_schedules WHERE organization_id=$1 AND thread_id IN (${threads})`;
const tasks = `SELECT id FROM followup_checkin_tasks WHERE organization_id=$1 AND schedule_id IN (${schedules})`;
const contracts = 'SELECT id FROM coach_contracts WHERE organization_id=$1 AND student_id=$2';
const charges = `SELECT id FROM coach_charges WHERE organization_id=$1 AND contract_id IN (${contracts})`;
const payments = `SELECT id FROM coach_payments WHERE organization_id=$1 AND charge_id IN (${charges})`;
const resources = `SELECT id FROM private_resources WHERE organization_id=$1 AND
  (subject_student_id=$2 OR (subject_student_id IS NULL AND collection_id IN
  (SELECT id FROM resource_collections WHERE organization_id=$1 AND student_id=$2)))`;
const dependentTables: Record<string, string> = {
  workout_sets: `session_id IN (${sessions})`,
  workout_events: `session_id IN (${sessions})`,
  workout_session_media: `session_id IN (${sessions})`,
  program_versions:
    'id IN (SELECT version_id FROM program_assignments WHERE organization_id=$1 AND student_id=$2)',
  nutrition_versions:
    'id IN (SELECT version_id FROM nutrition_assignments WHERE organization_id=$1 AND student_id=$2)',
  private_resources: `id IN (${resources})`,
  resource_versions: `resource_id IN (${resources})`,
  followup_messages: `thread_id IN (${threads})`,
  followup_attachments: `thread_id IN (${threads})`,
  followup_habits: `thread_id IN (${threads})`,
  followup_habit_entries: `habit_id IN (${habits})`,
  followup_checkin_schedules: `thread_id IN (${threads})`,
  followup_checkin_tasks: `id IN (${tasks})`,
  followup_checkin_responses: `task_id IN (${tasks})`,
  followup_checkin_versions: `id IN (SELECT version_id FROM followup_checkin_schedules WHERE organization_id=$1 AND thread_id IN (${threads}))`,
  coach_charges: `contract_id IN (${contracts})`,
  coach_adjustments: `charge_id IN (${charges})`,
  coach_payments: `id IN (${payments})`,
  coach_refunds: `payment_id IN (${payments})`,
  coach_session_entries: `contract_id IN (${contracts})`,
  coach_prospect_events:
    'prospect_id IN (SELECT id FROM coach_prospects WHERE organization_id=$1 AND student_id=$2)',
};
const excludedFields = new Set([
  'password_hash',
  'secret_hash',
  'token_hash',
  'receive_token',
  'lease_token',
  'input_key',
  'output_key',
  'poster_key',
  'storage_key',
  'thumbnail_key',
  'receipt_key',
]);
export function sanitizePrivacyRow(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizePrivacyRow);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  const withdrawn = record.withdrawn_at != null;
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !excludedFields.has(key))
      .map(([key, entry]) => [key, withdrawn && key === 'body' ? null : sanitizePrivacyRow(entry)]),
  );
}
export const privacyLimitations = [
  'Structured pupil dossier, not an integral portability or erasure certificate.',
  'No binary files, file paths, download tickets, authentication secrets, jobs or platform backups.',
  'Shared library/resources and general tenant/audit records require separate operator review.',
  'Global account deletion requires checking other memberships/profiles and retention obligations.',
  'No deletion, automatic retention deadline, backup purge or consent restoration is performed.',
];

export async function collectPrivacyData(pool: Pool, scope: PrivacyScope, mode: 'plan' | 'export') {
  for (const id of [scope.organizationId, scope.studentId, scope.operatorId, scope.requestId])
    if (!uuid.test(id)) throw new Error('INVALID_PRIVACY_SCOPE');
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(scope.ticket)) throw new Error('INVALID_PRIVACY_TICKET');
  if (mode !== 'plan' && mode !== 'export') throw new Error('INVALID_PRIVACY_MODE');
  const db = await pool.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await db.query("SET LOCAL statement_timeout='5s'");
    await db.query("SET LOCAL idle_in_transaction_session_timeout='15s'");
    // CLI uses an administrative DB connection, not HTTP authentication. This checks the named
    // responsible operator; possession of admin credentials remains the operational boundary.
    if (
      !(
        await db.query(
          "SELECT 1 FROM app_users WHERE id=$1 AND is_superadmin AND status='active'",
          [scope.operatorId],
        )
      ).rowCount
    )
      throw new Error('PRIVACY_OPERATOR_REQUIRED');
    const subject = (
      await db.query('SELECT id,user_id FROM students WHERE organization_id=$1 AND id=$2', [
        scope.organizationId,
        scope.studentId,
      ])
    ).rows[0];
    if (!subject) throw new Error('PRIVACY_SUBJECT_NOT_FOUND');
    const migrations = (
      await db.query('SELECT name FROM schema_migrations ORDER BY name')
    ).rows.map((r) => r.name as string);
    if (migrations.length !== 36 || migrations.at(-1) !== '036_common_food_names.sql')
      throw new Error('PRIVACY_SCHEMA_REVIEW_REQUIRED');
    const filters: Record<string, string> = {
      students: 'id=$2',
      ...Object.fromEntries(studentTables.map((table) => [table, 'student_id=$2'])),
      ...dependentTables,
    };
    if (subject.user_id) {
      for (const table of ['followup_reads', 'followup_notifications'])
        filters[table] = `user_id=$3 AND thread_id IN (${threads})`;
      for (const table of [
        'followup_notification_preferences',
        'agenda_preferences',
        'agenda_notifications',
      ])
        filters[table] = 'user_id=$3 AND $2::uuid IS NOT NULL';
    }
    const counts: Record<string, number> = {};
    const data: Record<string, unknown[]> = {};
    let bytes = 0;
    for (const [table, filter] of Object.entries(filters)) {
      const values = filter.includes('$3')
        ? [scope.organizationId, scope.studentId, subject.user_id]
        : [scope.organizationId, scope.studentId];
      const where = `organization_id=$1 AND (${filter})`;
      if (mode === 'plan') {
        counts[table] = Number(
          (await db.query(`SELECT count(*) n FROM public.${table} WHERE ${where}`, values)).rows[0]
            .n,
        );
      } else {
        const rows = (
          await db.query(
            `SELECT to_jsonb(t) row FROM public.${table} t WHERE ${where} LIMIT 1001`,
            values,
          )
        ).rows;
        if (rows.length > 1000) throw new Error('PRIVACY_EXPORT_REQUIRES_BATCHING');
        data[table] = rows.map((row) => sanitizePrivacyRow(row.row));
        counts[table] = rows.length;
        bytes += Buffer.byteLength(JSON.stringify(data[table]));
        if (bytes > 16 * 1024 * 1024) throw new Error('PRIVACY_EXPORT_REQUIRES_BATCHING');
      }
    }
    // Account identity is deliberately limited; never SELECT * FROM app_users.
    if (mode === 'export' && subject.user_id) {
      data.account = (
        await db.query(
          'SELECT id,email,full_name,status,created_at,privacy_version,privacy_accepted_at FROM app_users WHERE id=$1',
          [subject.user_id],
        )
      ).rows;
      counts.account = data.account.length;
    }
    await db.query('COMMIT');
    return {
      format: 'forma-pupil-data-v1',
      mode,
      scope,
      generatedAt: new Date().toISOString(),
      migrations,
      counts,
      limitations: privacyLimitations,
      review: {
        retention: 'pending-responsible-decision',
        sharedFiles: 'separate-authorized-review',
        immutableHistory: 'preserve-until-approved-policy',
        backups: 'reconcile-before-reopening',
        deletionExecuted: false,
      },
      ...(mode === 'export' ? { data } : {}),
    };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}

const magic = Buffer.from('FORMAPRIV1');
function checkPassphrase(passphrase: string) {
  if (passphrase.length < 24) throw new Error('PRIVACY_PASSPHRASE_MIN_24');
}
export function encryptPrivacyData(value: unknown, passphrase: string) {
  checkPassphrase(passphrase);
  const salt = randomBytes(16),
    iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', scryptSync(passphrase, salt, 32), iv);
  cipher.setAAD(magic);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([magic, salt, iv, cipher.getAuthTag(), encrypted]);
}
export function decryptPrivacyData(bytes: Buffer, passphrase: string): unknown {
  checkPassphrase(passphrase);
  if (bytes.length < 55 || !bytes.subarray(0, magic.length).equals(magic))
    throw new Error('INVALID_PRIVACY_ENVELOPE');
  const start = magic.length;
  const decipher = createDecipheriv(
    'aes-256-gcm',
    scryptSync(passphrase, bytes.subarray(start, start + 16), 32),
    bytes.subarray(start + 16, start + 28),
  );
  decipher.setAAD(magic);
  decipher.setAuthTag(bytes.subarray(start + 28, start + 44));
  return JSON.parse(
    Buffer.concat([decipher.update(bytes.subarray(start + 44)), decipher.final()]).toString('utf8'),
  );
}
