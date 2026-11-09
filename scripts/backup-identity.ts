import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
export function backupIdentity(connection: string, storage: string) {
  const u = new URL(connection);
  return {
    database: createHash('sha256')
      .update(`${u.hostname}:${u.port || '5432'}${u.pathname}`)
      .digest('hex'),
    storage: createHash('sha256').update(resolve(storage)).digest('hex'),
  };
}
