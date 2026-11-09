import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createPool } from '@forma/db';
import { rendererAvailable, claimDocumentJob, processDocumentJob } from './documents.js';
const pool = createPool(process.env.WORKER_DATABASE_URL),
  workerId = randomUUID();
let stopping = false,
  lastHeartbeat = 0;
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    stopping = true;
  });
while (!stopping) {
  try {
    if (Date.now() - lastHeartbeat > 15000) {
      await pool.query(
        'INSERT INTO document_worker_heartbeats(worker_id,renderer_available,scanner_configured)VALUES($1,$2,$3)ON CONFLICT(worker_id)DO UPDATE SET heartbeat_at=now(),renderer_available=excluded.renderer_available,scanner_configured=excluded.scanner_configured',
        [workerId, await rendererAvailable(), !!process.env.CLAMAV_HOST],
      );
      lastHeartbeat = Date.now();
    }
    const job = await claimDocumentJob(pool);
    if (job) {
      const ok = await processDocumentJob(pool, job);
      console.info(
        JSON.stringify({
          event: ok ? 'document.ready' : 'document.attempt_finished',
          jobId: job.id,
        }),
      );
      continue;
    }
  } catch {
    console.error(JSON.stringify({ event: 'document.worker_unavailable' }));
  }
  await new Promise((done) => setTimeout(done, 2000));
}
await pool.query('DELETE FROM document_worker_heartbeats WHERE worker_id=$1', [workerId]);
await pool.end();
