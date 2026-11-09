import 'dotenv/config';
import { demoConfig, demoDatabaseUrl } from './manual-demo-config.mjs';
import { migrate } from '../packages/db/src/migrate.ts';

const profile = await demoConfig();
if (!profile.ready) throw new Error('DEMO_NOT_PREPARED');
await migrate(demoDatabaseUrl(process.env.DATABASE_ADMIN_URL));
console.info('Migraciones aplicadas a la base ficticia; datos y cuentas conservados.');
