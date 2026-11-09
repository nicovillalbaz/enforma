import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createPool } from '@forma/db';
const pool = createPool(process.env.WORKER_DATABASE_URL);
try {
  const { workerId } = JSON.parse(await readFile('.local/media-worker.json', 'utf8')) as {
    workerId: string;
  };
  const row = (
    await pool.query<{ online: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM media_worker_heartbeats WHERE worker_id=$1 AND available AND heartbeat_at>now()-interval '30 seconds') online",
      [workerId],
    )
  ).rows[0];
  if (!row?.online) process.exitCode = 1;
} catch {
  process.exitCode = 1;
} finally {
  await pool.end();
}
