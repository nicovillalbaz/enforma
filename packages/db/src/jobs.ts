import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
export interface Job {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  lease_token: string;
}
export async function claimJob(pool: Pool, kinds?: string[]): Promise<Job | undefined> {
  await pool.query(
    "UPDATE jobs SET status='failed',error_code='LEASE_EXPIRED' WHERE status='running' AND leased_until<now() AND attempts>=max_attempts",
  );
  const result = await pool.query<Job>(
    `WITH candidate AS (
    SELECT id FROM jobs WHERE ((status='ready' AND available_at<=now()) OR (status='running' AND leased_until<now())) AND attempts<max_attempts AND ($2::text[] IS NULL OR kind=ANY($2))
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE jobs SET status='running',attempts=attempts+1,leased_until=now()+interval '2 minutes',lease_token=$1
    FROM candidate WHERE jobs.id=candidate.id RETURNING jobs.id,kind,payload,attempts,max_attempts,lease_token`,
    [randomUUID(), kinds ?? null],
  );
  return result.rows[0];
}
export async function finishJob(pool: Pool, job: Job) {
  await pool.query(
    "UPDATE jobs SET status='completed',completed_at=now(),leased_until=NULL,payload='{}' WHERE id=$1 AND lease_token=$2 AND status='running'",
    [job.id, job.lease_token],
  );
}
export async function failJob(pool: Pool, job: Job) {
  const delay = Math.min(3600, 2 ** job.attempts * 5);
  await pool.query(
    "UPDATE jobs SET status=CASE WHEN attempts>=max_attempts THEN 'failed' ELSE 'ready' END,available_at=now()+$3*interval '1 second',leased_until=NULL,error_code='HANDLER_FAILED' WHERE id=$1 AND lease_token=$2 AND status='running'",
    [job.id, job.lease_token, delay],
  );
}
