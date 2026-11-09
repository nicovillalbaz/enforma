import 'dotenv/config';
import { Kysely, PostgresDialect, type Transaction } from 'kysely';
import pg from 'pg';

export interface Database {
  app_users: {
    id: string;
    email: string;
    password_hash: string;
    full_name: string;
    status: string;
    created_at: Date;
  };
  audit_logs: {
    id: string;
    organization_id: string;
    actor_user_id: string | null;
    action: string;
    created_at: Date;
  };
}

export function createPool(connectionString = process.env.DATABASE_URL) {
  return new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
  });
}

export function createDatabase(connectionString = process.env.DATABASE_URL) {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: createPool(connectionString) }),
  });
}

export async function withOrganization<T>(
  db: Kysely<Database>,
  context: { organizationId: string; userId: string },
  execute: (trx: Transaction<Database>) => Promise<T>,
): Promise<T> {
  // Call only with a membership already verified against the authenticated identity.
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(context.organizationId) || !uuid.test(context.userId))
    throw new Error('Invalid context');
  return db.transaction().execute(async (trx) => {
    const { sql } = await import('kysely');
    await sql`select set_config('app.organization_id', ${context.organizationId}, true), set_config('app.user_id', ${context.userId}, true)`.execute(
      trx,
    );
    return execute(trx);
  });
}
