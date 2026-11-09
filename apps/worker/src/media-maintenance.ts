import { readdir, lstat, unlink, rmdir } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import type { Pool, PoolClient } from 'pg';
import { PrivateStorage } from '../../api/src/storage.js';
export async function maintainMedia(
  pool: Pool,
  root = process.env.STORAGE_PATH ?? '.local/storage',
) {
  const client = await pool.connect();
  try {
    // Shared with backup.ts: no referenced file disappears during its snapshot copy.
    await client.query('SELECT pg_advisory_lock(70321021)');
    return await maintainUnlocked(client, root);
  } finally {
    await client.query('SELECT pg_advisory_unlock(70321021)');
    client.release();
  }
}
async function maintainUnlocked(pool: PoolClient, root: string) {
  const storage = new PrivateStorage(root);
  const removed = (await pool.query<{ keys: string[] }>('SELECT app.media_maintenance() keys'))
    .rows[0]!.keys;
  let count = 0;
  for (const key of new Set(removed)) {
    try {
      await storage.remove(key);
      count++;
    } catch {
      /* A later orphan pass retries a failed unlink. */
    }
  }
  const references = new Set(
    (
      await pool.query<{ key: string | null }>('SELECT app.media_storage_references() key')
    ).rows.map((row) => row.key),
  );
  const absolute = resolve(root);
  for (const item of await readdir(absolute, { withFileTypes: true }).catch(() => [])) {
    if (!item.isFile() || item.isSymbolicLink() || references.has(item.name)) continue;
    if (!/^[0-9a-f-]{36}\.(bin|webp|mp4|jpg|pdf)(\.pending)?$/.test(item.name)) continue;
    const path = resolve(join(absolute, item.name));
    if (!path.startsWith(`${absolute}${sep}`)) continue;
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || Date.now() - stat.mtimeMs < 86400000) continue;
    await unlink(path)
      .then(() => count++)
      .catch(() => {});
  }
  const scratchRoot = resolve('.local/media-work');
  for (const item of await readdir(scratchRoot, { withFileTypes: true }).catch(() => [])) {
    if (!item.isDirectory() || item.isSymbolicLink() || !/^job-[a-zA-Z0-9]{6}$/.test(item.name))
      continue;
    const path = resolve(scratchRoot, item.name);
    if (!path.startsWith(`${scratchRoot}${sep}`)) continue;
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || Date.now() - stat.mtimeMs < 3600000) continue;
    for (const name of ['clip.mp4', 'poster.jpg']) {
      const file = join(path, name);
      try {
        const info = await lstat(file);
        if (info.isFile() && !info.isSymbolicLink()) await unlink(file);
      } catch {
        /* Only remove the two known scratch outputs. */
      }
    }
    await rmdir(path).catch(() => {});
  }
  return { removedFiles: count };
}
