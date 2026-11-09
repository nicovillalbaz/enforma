import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { createPool } from '@forma/db';
import { claimMediaJob, processMediaJob, mediaEngineVersion } from './media.js';
import { maintainMedia } from './media-maintenance.js';
const pool = createPool(process.env.WORKER_DATABASE_URL);
const workerId = randomUUID();
await mkdir('.local', { recursive: true });
await writeFile('.local/media-worker.json', JSON.stringify({ workerId, pid: process.pid }), {
  mode: 0o600,
});
let stopping = false;
let available = false;
let engineVersion = 'unavailable';
const active = new Set<Promise<void>>();
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    stopping = true;
  });
const heartbeat = async () => {
  await pool.query(
    'INSERT INTO media_worker_heartbeats(worker_id,available,active_jobs,engine_version)VALUES($1,$2,$3,$4)ON CONFLICT(worker_id)DO UPDATE SET heartbeat_at=clock_timestamp(),available=excluded.available,active_jobs=excluded.active_jobs,engine_version=excluded.engine_version',
    [workerId, available, active.size, engineVersion],
  );
};
let lastMaintenance = 0,
  lastHeartbeat = 0;
while (!stopping) {
  try {
    if (Date.now() - lastHeartbeat > 5000) {
      try {
        engineVersion = await mediaEngineVersion();
        available = (
          await pool.query<{ ready: boolean }>(
            "SELECT has_schema_privilege(current_user,'app','USAGE') AND has_function_privilege(current_user,'app.worker_media_start(uuid,uuid)','EXECUTE') AND has_function_privilege(current_user,'app.worker_media_finish(uuid,uuid,jsonb)','EXECUTE') ready",
          )
        ).rows[0]!.ready;
      } catch {
        available = false;
      }
      await heartbeat();
      lastHeartbeat = Date.now();
    }
    if (Date.now() - lastMaintenance > 60000) {
      await maintainMedia(pool);
      lastMaintenance = Date.now();
    }
    if (
      available &&
      active.size < Math.max(1, Math.min(2, Number(process.env.MEDIA_WORKER_CONCURRENCY ?? 1)))
    ) {
      const job = await claimMediaJob(pool);
      if (job) {
        const task = processMediaJob(pool, job, { engineVersion })
          .then((success) => {
            console.info(
              JSON.stringify({
                event: success ? 'media.ready' : 'media.attempt_finished',
                job_id: job.id,
              }),
            );
          })
          .catch(() => {
            console.error(JSON.stringify({ event: 'media.worker_error', job_id: job.id }));
          })
          .finally(() => active.delete(task));
        active.add(task);
        continue;
      }
    }
  } catch {
    console.error(JSON.stringify({ event: 'media.database_unavailable' }));
  }
  await new Promise((done) => setTimeout(done, 500));
}
await Promise.allSettled(active);
await pool.query('DELETE FROM media_worker_heartbeats WHERE worker_id=$1', [workerId]);
await unlink('.local/media-worker.json').catch(() => {});
await pool.end();
