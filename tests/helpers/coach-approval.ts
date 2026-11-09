import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

// Test setup only. Never import from application code or use against a working database.
export async function approveFixtureCoach(
  pool: Pool,
  organizationId: string,
  options: { limit?: number; legacy?: boolean } = {},
) {
  const db = await pool.connect();
  try {
    const name = (await db.query('SELECT current_database() name')).rows[0].name as string;
    if (!/^forma_(?:media_)?test_[a-f0-9]{32}$/.test(name))
      throw new Error('Coach fixture approval requires an isolated test database');
    await db.query('BEGIN');
    const owner = (
      await db.query(
        `SELECT u.id,u.email FROM organizations o JOIN app_users u ON u.id=o.owner_user_id WHERE o.id=$1`,
        [organizationId],
      )
    ).rows[0];
    if (!owner?.email.endsWith('@example.test')) throw new Error('Synthetic coach required');
    const operator = randomUUID();
    await db.query(
      `INSERT INTO app_users(id,email,password_hash,full_name,is_superadmin)
       SELECT $1,$2,password_hash,'Operador de fixture',true FROM app_users WHERE id=$3`,
      [operator, 'fixture-' + operator + '@example.test', owner.id],
    );
    await db.query("SELECT set_config('app.user_id',$1,true)", [operator]);
    const revision =
      (
        await db.query('SELECT revision FROM manual_coach_controls WHERE organization_id=$1', [
          organizationId,
        ])
      ).rows[0]?.revision ?? 0;
    await db.query('SELECT app.manual_configure($1,$2,NULL,true,$3,$4,$5)', [
      organizationId,
      options.limit ?? 25,
      revision,
      randomUUID(),
      'Aprobación explícita del operador en fixture aislada',
    ]);
    if (options.legacy) {
      // Reconstruct a pre-023 tenant ONLY for historical billing/migration regression.
      await db.query('DELETE FROM manual_coach_controls WHERE organization_id=$1', [
        organizationId,
      ]);
      await db.query("UPDATE organizations SET status='trial' WHERE id=$1", [organizationId]);
      await db.query("UPDATE saas_subscriptions SET status='trial' WHERE organization_id=$1", [
        organizationId,
      ]);
    }
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
