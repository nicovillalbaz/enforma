import 'dotenv/config';
import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import pg from 'pg';
export default async function setup() {
  const pool = new pg.Pool({ connectionString: process.env.WORKER_DATABASE_URL });
  async function online() {
    try {
      const data = JSON.parse(await readFile('.local/media-worker.json', 'utf8')) as {
        workerId: string;
        pid: number;
      };
      if (!data.pid) return false;
      process.kill(data.pid, 0);
      return Boolean(
        (
          await pool.query<{ online: boolean }>(
            "SELECT EXISTS(SELECT 1 FROM media_worker_heartbeats WHERE worker_id=$1 AND available AND heartbeat_at>now()-interval '30 seconds') online",
            [data.workerId],
          )
        ).rows[0]?.online,
      );
    } catch {
      return false;
    }
  }
  if (await online()) {
    await pool.end();
    return;
  }
  const child = spawn(process.execPath, ['--import', 'tsx', 'apps/worker/src/media-server.ts'], {
    stdio: 'ignore',
    windowsHide: true,
  });
  let spawnFailed = false;
  child.once('error', () => {
    spawnFailed = true;
  });
  const cleanup = async () => {
    child.kill('SIGTERM');
    await new Promise((done) => setTimeout(done, 300));
    try {
      const data = JSON.parse(await readFile('.local/media-worker.json', 'utf8')) as {
        workerId: string;
        pid: number;
      };
      if (data.pid === child.pid) {
        await pool.query('DELETE FROM media_worker_heartbeats WHERE worker_id=$1', [data.workerId]);
        await unlink('.local/media-worker.json');
      }
    } catch {
      /* Only clean metadata owned by this test process. */
    }
    await pool.end();
  };
  const start = Date.now();
  while (Date.now() - start < 30000 && !spawnFailed && child.exitCode === null) {
    if (await online()) return cleanup;
    await new Promise((done) => setTimeout(done, 300));
  }
  await cleanup();
  throw new Error('El worker de medios no arrancó. Comprueba las migraciones, FFmpeg y FFprobe.');
}
