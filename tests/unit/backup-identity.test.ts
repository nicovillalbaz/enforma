import { it, expect } from 'vitest';
import { backupIdentity } from '../../scripts/backup-identity.js';
it('does not credit an isolated database or another storage directory as the application backup', () => {
  const original = backupIdentity(
    'postgres://admin:secret@127.0.0.1:54329/forma',
    '.local/storage',
  );
  expect(
    backupIdentity('postgres://other:changed@127.0.0.1:54329/forma', '.local/storage'),
  ).toEqual(original);
  expect(
    backupIdentity('postgres://admin:secret@127.0.0.1:54329/forma_test_isolated', '.local/storage')
      .database,
  ).not.toBe(original.database);
  expect(
    backupIdentity('postgres://admin:secret@127.0.0.1:54329/forma', '.local/other-storage').storage,
  ).not.toBe(original.storage);
  expect(JSON.stringify(original)).not.toContain('secret');
});
