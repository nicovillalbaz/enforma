import 'dotenv/config';
import { createPool } from '@forma/db';
import { maintainMedia } from '../apps/worker/src/media-maintenance.js';
const pool = createPool(process.env.WORKER_DATABASE_URL);
try {
  console.info(JSON.stringify(await maintainMedia(pool)));
} finally {
  await pool.end();
}
