import type { Pool } from 'pg';
import { claimJob } from '../../../packages/db/src/jobs.js';
export async function agendaTick(pool: Pool, maxJobs = 50) {
  await pool.query('SELECT app.agenda_schedule_tick()');
  let processed = 0;
  for (let i = 0; i < Math.min(50, Math.max(0, maxJobs)); i++) {
    const job = await claimJob(pool, ['notification.internal']);
    if (!job) break;
    try {
      await pool.query('SELECT app.worker_agenda_deliver($1,$2)', [job.id, job.lease_token]);
    } catch {
      await pool.query('SELECT app.worker_agenda_fail($1,$2)', [job.id, job.lease_token]);
    }
    processed++;
  }
  return processed;
}
