import 'dotenv/config';
import { mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { collectPrivacyData, encryptPrivacyData, decryptPrivacyData } from './privacy-data.js';

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === '--help' || !mode) {
    console.info(
      'privacy plan|export --organization UUID --student UUID --operator UUID --ticket ID\nprivacy open --input UUID.formapriv\nPrivate output: .local/privacy. Set PRIVACY_EXPORT_PASSPHRASE (24+ characters), never in CLI arguments. No deletion command.',
    );
    return;
  }
  if (!['plan', 'export', 'open'].includes(mode)) throw new Error('INVALID_PRIVACY_MODE');
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]!,
      value = args[i + 1];
    if (
      !['--organization', '--student', '--operator', '--ticket', '--input'].includes(key) ||
      !value ||
      flags.has(key)
    )
      throw new Error('INVALID_PRIVACY_ARGUMENTS');
    flags.set(key, value);
  }
  const secret = process.env.PRIVACY_EXPORT_PASSPHRASE ?? '';
  if (secret.length < 24) throw new Error('PRIVACY_PASSPHRASE_MIN_24');
  const root = resolve('.local/privacy');
  await mkdir(resolve('.local'), { recursive: true, mode: 0o700 });
  if ((await lstat(resolve('.local'))).isSymbolicLink())
    throw new Error('INVALID_PRIVACY_DIRECTORY');
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await lstat(root)).isSymbolicLink()) throw new Error('INVALID_PRIVACY_DIRECTORY');
  const requestId = randomUUID();
  if (mode === 'open') {
    const input = flags.get('--input') ?? '';
    if (flags.size !== 1 || !/^[a-f0-9-]{36}\.formapriv$/.test(input))
      throw new Error('INVALID_PRIVACY_INPUT');
    const path = resolve(root, input);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 20 * 1024 * 1024)
      throw new Error('INVALID_PRIVACY_INPUT');
    const value = decryptPrivacyData(await readFile(path), secret);
    await writeFile(resolve(root, requestId + '.review.json'), JSON.stringify(value, null, 2), {
      flag: 'wx',
      mode: 0o600,
    });
    console.info('Private review created: ' + requestId + '.review.json');
    return;
  }
  if (flags.size !== 4 || flags.has('--input')) throw new Error('INVALID_PRIVACY_ARGUMENTS');
  if (!process.env.DATABASE_ADMIN_URL) throw new Error('PRIVACY_DATABASE_REQUIRED');
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_ADMIN_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  try {
    const value = await collectPrivacyData(
      pool,
      {
        organizationId: flags.get('--organization')!,
        studentId: flags.get('--student')!,
        operatorId: flags.get('--operator')!,
        ticket: flags.get('--ticket')!,
        requestId,
      },
      mode as 'plan' | 'export',
    );
    const encrypted = encryptPrivacyData(value, secret);
    await writeFile(resolve(root, requestId + '.formapriv'), encrypted, {
      flag: 'wx',
      mode: 0o600,
    });
    await writeFile(
      resolve(root, requestId + '.audit.json'),
      JSON.stringify(
        {
          requestId,
          mode,
          generatedAt: value.generatedAt,
          ticket: value.scope.ticket,
          organizationId: value.scope.organizationId,
          studentId: value.scope.studentId,
          operatorId: value.scope.operatorId,
          sha256: createHash('sha256').update(encrypted).digest('hex'),
          deletionExecuted: false,
        },
        null,
        2,
      ),
      { flag: 'wx', mode: 0o600 },
    );
    console.info('Private package created: ' + requestId + '.formapriv');
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  // Never echo pg errors, rows, paths supplied by a user, connection strings or secrets.
  console.error(
    'Privacy operation failed. Check scope, active operator, schema 024, size limits and private directory; no deletion was performed.',
  );
  process.exitCode = 1;
});
