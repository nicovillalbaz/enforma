import 'dotenv/config';
import { createPool } from '@forma/db';
import { agendaTick } from './agenda.js';
const pool = createPool(process.env.WORKER_DATABASE_URL);
let stopping = false,
  timer: ReturnType<typeof setTimeout> | undefined,
  release: (() => void) | undefined;
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    stopping = true;
    if (timer) clearTimeout(timer);
    release?.();
  });
while (!stopping) {
  try {
    await pool.query('SELECT app.followup_schedule_tick()');
  } catch {
    console.error(JSON.stringify({ event: 'followup.schedule_unavailable' }));
  }
  if (!stopping) {
    try {
      await agendaTick(pool);
    } catch {
      console.error(JSON.stringify({ event: 'agenda.schedule_unavailable' }));
    }
  }
  if (!stopping)
    try {
      await pool.query('SELECT app.coach_retention_tick()');
    } catch {
      console.error(JSON.stringify({ event: 'coach.retention_unavailable' }));
    }
  if (!stopping)
    await new Promise<void>((done) => {
      release = done;
      timer = setTimeout(done, 60000);
    });
}
await pool.end();
