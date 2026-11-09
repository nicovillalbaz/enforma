import 'dotenv/config';
import { createBackup } from './backup.js';
if (!process.env.BACKUP_PATH)
  throw new Error('Set BACKUP_PATH to the separately mounted backup destination');
while (true) {
  try {
    await createBackup();
    console.info(JSON.stringify({ event: 'backup.completed', time: new Date().toISOString() }));
  } catch {
    console.error(JSON.stringify({ event: 'backup.failed', time: new Date().toISOString() }));
    process.exitCode = 1;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 24 * 60 * 60 * 1000));
}
