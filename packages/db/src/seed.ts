import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import pg from 'pg';

if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
const client = new pg.Client({ connectionString: process.env.DATABASE_ADMIN_URL });
await client.connect();
try {
  const passwordHash = await hash('Forma-demo-2026!', {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await client.query(
    "INSERT INTO app_users (id,email,password_hash,full_name) VALUES ('10000000-0000-4000-8000-000000000001','coach@forma.local',$1,'Nico González') ON CONFLICT DO NOTHING",
    [passwordHash],
  );
  await client.query(
    "INSERT INTO organizations (id,name,slug) VALUES ('20000000-0000-4000-8000-000000000001','Nico Studio','nico-studio') ON CONFLICT DO NOTHING",
  );
  await client.query(
    "INSERT INTO organization_memberships (organization_id,user_id,role) VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner') ON CONFLICT DO NOTHING",
  );
  await client.query(
    "UPDATE app_users SET email_verified_at=coalesce(email_verified_at,now()) WHERE id='10000000-0000-4000-8000-000000000001'",
  );
  await client.query(
    "UPDATE organizations SET owner_user_id='10000000-0000-4000-8000-000000000001' WHERE id='20000000-0000-4000-8000-000000000001' AND owner_user_id IS NULL",
  );
  await client.query(
    "INSERT INTO organization_branding(organization_id)VALUES('20000000-0000-4000-8000-000000000001')ON CONFLICT DO NOTHING",
  );
  await client.query(
    "INSERT INTO saas_subscriptions(organization_id,plan_version_id)VALUES('20000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001')ON CONFLICT DO NOTHING",
  );
  await client.query(
    "INSERT INTO app_users(id,email,password_hash,full_name)VALUES('10000000-0000-4000-8000-000000000002','admin@forma.local',$1,'Administrador local') ON CONFLICT DO NOTHING",
    [passwordHash],
  );
  await client.query(
    "UPDATE app_users SET is_superadmin=true,email_verified_at=coalesce(email_verified_at,now()) WHERE id='10000000-0000-4000-8000-000000000002' AND email='admin@forma.local'",
  );
  console.info('Development account is ready. See docs/runbooks/desarrollo.md for access.');
} finally {
  await client.end();
}
