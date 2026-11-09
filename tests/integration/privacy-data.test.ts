import 'dotenv/config';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import pg from 'pg';
import { isolatedDatabase } from '../helpers/database.js';
import { approveFixtureCoach } from '../helpers/coach-approval.js';
import {
  collectPrivacyData,
  encryptPrivacyData,
  decryptPrivacyData,
} from '../../scripts/privacy-data.js';

const fixture = isolatedDatabase();
const pool = new pg.Pool({ connectionString: fixture.url(process.env.DATABASE_ADMIN_URL), max: 1 });
let storage: string;
beforeAll(async () => {
  storage = await fixture.create();
});
afterAll(async () => {
  await pool.end();
  await fixture.drop();
  if (storage) {
    if (
      dirname(resolve(storage)) !== resolve('.local/test-storage') ||
      !/^forma_test_[a-f0-9]{32}-/.test(basename(storage))
    )
      throw new Error('Invalid fixture storage');
    await rm(storage, { recursive: true });
  }
});

it('exports one pupil across modules, denies mismatched scopes/operators and preserves data and secrets', async () => {
  const ownerA = randomUUID(),
    ownerB = randomUUID(),
    pupil = randomUUID(),
    operator = randomUUID();
  for (const [id, admin] of [
    [ownerA, false],
    [ownerB, false],
    [pupil, false],
    [operator, true],
  ] as const)
    await pool.query(
      'INSERT INTO app_users(id,email,password_hash,full_name,is_superadmin) VALUES($1,$2,$3,$4,$5)',
      [id, id + '@example.test', 'NEVER_EXPORT_PASSWORD_HASH', 'Persona sintética', admin],
    );
  async function organization(owner: string) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query("SELECT set_config('app.user_id',$1,true)", [owner]);
      const org = (
        await db.query(
          "SELECT app.create_organization('Coach QA',$1,'coach','#005ea8','basic') id",
          ['privacy-' + randomUUID().slice(0, 8)],
        )
      ).rows[0].id as string;
      await db.query('COMMIT');
      return org;
    } finally {
      db.release();
    }
  }
  const orgA = await organization(ownerA),
    orgB = await organization(ownerB);
  expect(
    (await pool.query('SELECT status FROM organizations WHERE id=$1', [orgA])).rows[0].status,
  ).toBe('suspended');
  await approveFixtureCoach(pool, orgA, { limit: 2 });
  expect(
    (await pool.query('SELECT status FROM organizations WHERE id=$1', [orgA])).rows[0].status,
  ).toBe('active');
  await approveFixtureCoach(pool, orgB, { legacy: true });
  expect(
    (
      await pool.query('SELECT count(*) n FROM manual_coach_controls WHERE organization_id=$1', [
        orgB,
      ])
    ).rows[0].n,
  ).toBe('0');
  const studentA = randomUUID(),
    studentB = randomUUID(),
    peer = randomUUID();
  for (const [id, org, user, name] of [
    [studentA, orgA, pupil, 'Alumno solicitado'],
    [studentB, orgB, pupil, 'OTRO_ESTUDIO_NO_EXPORTAR'],
    [peer, orgA, null, 'OTRO_ALUMNO_NO_EXPORTAR'],
  ])
    await pool.query(
      "INSERT INTO students(id,organization_id,user_id,display_name,contact_email,status) VALUES($1,$2,$3,$4,$5,'active')",
      [id, org, user, name, id + '@example.test'],
    );
  const thread = randomUUID(),
    peerThread = randomUUID();
  for (const [id, student] of [
    [thread, studentA],
    [peerThread, peer],
  ])
    await pool.query(
      'INSERT INTO followup_threads(id,organization_id,student_id,professional_id) VALUES($1,$2,$3,$4)',
      [id, orgA, student, ownerA],
    );
  for (const [threadId, body, withdrawn] of [
    [thread, 'Mensaje conservado', false],
    [thread, 'RETIRADO_NO_EXPORTAR', true],
    [peerThread, 'OTRO_HILO_NO_EXPORTAR', false],
  ] as const)
    await pool.query(
      `INSERT INTO followup_messages(organization_id,thread_id,seq,sender_id,client_id,intent_hash,body,withdrawn_at)
    VALUES($1,$2,$3,$4,$5,'synthetic',$6,CASE WHEN $7 THEN now() ELSE NULL END)`,
      [orgA, threadId, withdrawn ? 2 : 1, ownerA, randomUUID(), body, withdrawn],
    );
  for (const [student, caption] of [
    [studentA, 'Foto retirada propia'],
    [peer, 'FOTO_AJENA_NO_EXPORTAR'],
  ])
    await pool.query(
      `INSERT INTO progress_photos(organization_id,student_id,request_id,source_hash,measured_on,caption,storage_key,thumbnail_key,byte_size,width,height,created_by,deleted_at)
    VALUES($1,$2,$3,'synthetic',current_date,$4,'PRIVATE_PATH.jpg','PRIVATE_THUMB.jpg',100,10,10,$5,now())`,
      [orgA, student, randomUUID(), caption, ownerA],
    );
  for (const student of [studentA, peer])
    await pool.query(
      `INSERT INTO anthropometry_assessments
       (organization_id,student_id,request_id,protocol,assessed_on,created_by,notes)
       VALUES($1,$2,$3,'free',current_date,$4,$5)`,
      [
        orgA,
        student,
        randomUUID(),
        ownerA,
        student === peer ? 'OTRA_ANTROPOMETRIA_NO_EXPORTAR' : 'Medición propia',
      ],
    );
  const scope = {
    organizationId: orgA,
    studentId: studentA,
    operatorId: operator,
    requestId: randomUUID(),
    ticket: 'QA-PRIVACY',
  };
  await expect(
    collectPrivacyData(pool, { ...scope, operatorId: ownerA }, 'export'),
  ).rejects.toThrow('PRIVACY_OPERATOR_REQUIRED');
  await expect(
    collectPrivacyData(pool, { ...scope, organizationId: orgB }, 'export'),
  ).rejects.toThrow('PRIVACY_SUBJECT_NOT_FOUND');
  const before = (await pool.query('SELECT count(*) n FROM followup_messages')).rows[0].n;
  const exported = await collectPrivacyData(pool, scope, 'export');
  expect(exported.counts.students).toBe(1);
  expect(exported.counts.followup_messages).toBe(2);
  expect(exported.counts.progress_photos).toBe(1);
  expect(exported.counts.anthropometry_assessments).toBe(1);
  const text = JSON.stringify(exported);
  expect(text).toContain('Mensaje conservado');
  expect(text).toContain('Alumno solicitado');
  for (const forbidden of [
    'NEVER_EXPORT_PASSWORD_HASH',
    'OTRO_ESTUDIO_NO_EXPORTAR',
    'OTRO_ALUMNO_NO_EXPORTAR',
    'OTRO_HILO_NO_EXPORTAR',
    'RETIRADO_NO_EXPORTAR',
    'PRIVATE_PATH',
    'PRIVATE_THUMB',
    'FOTO_AJENA_NO_EXPORTAR',
    'OTRA_ANTROPOMETRIA_NO_EXPORTAR',
  ])
    expect(text).not.toContain(forbidden);
  const plan = await collectPrivacyData(pool, scope, 'plan');
  expect(plan.counts.followup_messages).toBe(2);
  expect(plan).not.toHaveProperty('data');
  expect(plan.review.deletionExecuted).toBe(false);
  const passphrase = 'Synthetic-private-package-only-2026!';
  const encrypted = encryptPrivacyData(exported, passphrase);
  expect(encrypted.includes(Buffer.from('Alumno solicitado'))).toBe(false);
  expect(decryptPrivacyData(encrypted, passphrase)).toEqual(JSON.parse(text));
  const damaged = Buffer.from(encrypted);
  damaged[damaged.length - 1]! ^= 1;
  expect(() => decryptPrivacyData(damaged, passphrase)).toThrow();
  expect(() => decryptPrivacyData(encrypted, 'Incorrect-synthetic-passphrase-2026!')).toThrow();
  expect((await pool.query('SELECT count(*) n FROM followup_messages')).rows[0].n).toBe(before);
  // Do not silently use an unreviewed future schema.
  await pool.query(
    "INSERT INTO schema_migrations(name,checksum) VALUES('037_synthetic.sql','synthetic')",
  );
  await expect(collectPrivacyData(pool, scope, 'plan')).rejects.toThrow(
    'PRIVACY_SCHEMA_REVIEW_REQUIRED',
  );
});
