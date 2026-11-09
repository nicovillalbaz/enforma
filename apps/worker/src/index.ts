import 'dotenv/config';
import nodemailer from 'nodemailer';
import { createPool } from '@forma/db';
import { claimJob, finishJob, failJob } from '../../../packages/db/src/jobs.js';
import { transactionalMail } from '../../api/src/mail.js';

const pool = createPool(process.env.WORKER_DATABASE_URL);
const mail = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: process.env.SMTP_SECURE === 'true',
  ...(process.env.SMTP_USER
    ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }
    : {}),
  connectionTimeout: 10000,
  socketTimeout: 15000,
});
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    stopping = true;
  });
while (!stopping) {
  try {
    const job = await claimJob(pool, [
      'email.password_reset',
      'email.verification',
      'email.invitation',
      'system.echo',
    ]);
    if (!job) {
      await new Promise((done) => setTimeout(done, 1000));
      continue;
    }
    try {
      if (
        ['email.password_reset', 'email.verification', 'email.invitation'].includes(job.kind) &&
        typeof job.payload.to === 'string' &&
        typeof job.payload.url === 'string'
      ) {
        await mail.sendMail({
          from: process.env.SMTP_FROM,
          ...transactionalMail(job.kind, job.payload),
          messageId: `<${job.id}@forma.local>`,
        });
      } else if (job.kind !== 'system.echo') throw new Error('Unsupported job kind');
      await finishJob(pool, job);
      console.info(JSON.stringify({ event: 'job.completed', job_id: job.id, kind: job.kind }));
    } catch {
      await failJob(pool, job);
      console.error(JSON.stringify({ event: 'job.failed', job_id: job.id, kind: job.kind }));
    }
  } catch {
    console.error(JSON.stringify({ event: 'worker.database_unavailable' }));
    await new Promise((done) => setTimeout(done, 5000));
  }
}
await pool.end();
