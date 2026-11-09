import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { request } from 'playwright';
import { demoConfig, demoOrigin } from '../../scripts/manual-demo-config.mjs';

const report = { date: '2026-10-26', checks: [] };
const config = await demoConfig();
const api = await request.newContext({ baseURL: demoOrigin });
let stage = 'login';
async function call(method, path, body, csrf) {
  const response = await api.fetch(path, {
    method,
    ...(body ? { data: body, headers: { 'X-CSRF-Token': csrf } } : {}),
  });
  return { status: response.status(), body: await response.json() };
}
try {
  const csrf = (await call('GET', '/v1/security/csrf')).body.token;
  const signed = await call(
    'POST',
    '/v1/auth/login',
    { email: 'coach.aurora@example.test', password: config.password },
    csrf,
  );
  assert.equal(signed.status, 200);
  const orgs = await call('GET', '/v1/organizations');
  const org = orgs.body.organizations.find((o) => o.role === 'owner');
  assert(org);
  const pupils = await call('GET', `/v1/organizations/${org.id}/students`);
  const luna = pupils.body.students.find((p) => /luna/i.test(p.displayName));
  assert(luna);
  const root = `/v1/organizations/${org.id}/anthropometry/${luna.id}`;
  const list = await call('GET', `${root}?from=2026-10-20&to=2026-10-26`);
  assert.equal(list.status, 200);
  const marker = 'T17 corrección ficticia 26-10-2026';
  if (
    list.body.assessments.some((a) => a.notes === marker && a.correctionOf && a.status === 'final')
  ) {
    report.checks.push('historical correction already verified');
  } else {
    stage = 'original';
    const input = {
      protocol: 'bia',
      assessedOn: '2026-10-24',
      instrument: '',
      notes: marker,
      observations: [],
      equationPopulation: null,
      ageYears: null,
      externalBodyFatPercent: 24.3,
      externalDevice: 'Equipo ficticio T17',
      externalAlgorithm: 'algoritmo de ejemplo',
    };
    let original = list.body.assessments.find((a) => a.notes === marker && a.status === 'final');
    if (!original) {
      const created = await call('POST', root, { requestId: crypto.randomUUID(), input }, csrf);
      assert.equal(created.status, 200, JSON.stringify(created.body));
      const final = await call(
        'POST',
        `${root}/${created.body.assessment.id}/finalize`,
        { revision: created.body.assessment.revision },
        csrf,
      );
      assert.equal(final.status, 200, JSON.stringify(final.body));
      original = final.body.assessment;
    }
    assert.equal(original.result.estimate.method, 'external-bia');
    const immutable = await call(
      'PUT',
      `${root}/${original.id}`,
      { revision: original.revision, input },
      csrf,
    );
    assert.equal(immutable.status, 409);
    report.checks.push('finalized fact cannot be edited');
    stage = 'discard-correction';
    const first = await call(
      'POST',
      `${root}/${original.id}/correct`,
      { reason: 'Error ficticio de transcripción', requestId: crypto.randomUUID() },
      csrf,
    );
    assert.equal(first.status, 200, JSON.stringify(first.body));
    const abandoned = await call(
      'POST',
      `${root}/${first.body.assessment.id}/void`,
      { reason: 'Borrador descartado', revision: first.body.assessment.revision },
      csrf,
    );
    assert.equal(abandoned.status, 200, JSON.stringify(abandoned.body));
    stage = 'retry-correction';
    const second = await call(
      'POST',
      `${root}/${original.id}/correct`,
      { reason: 'Corrección ficticia final', requestId: crypto.randomUUID() },
      csrf,
    );
    assert.equal(second.status, 200, JSON.stringify(second.body));
    const updated = await call(
      'PUT',
      `${root}/${second.body.assessment.id}`,
      {
        revision: second.body.assessment.revision,
        input: { ...input, externalBodyFatPercent: 23.8 },
      },
      csrf,
    );
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    const final = await call(
      'POST',
      `${root}/${updated.body.assessment.id}/finalize`,
      { revision: updated.body.assessment.revision },
      csrf,
    );
    assert.equal(final.status, 200, JSON.stringify(final.body));
    assert.equal(final.body.assessment.result.estimate.bodyFatPercent, 23.8);
    const history = await call('GET', `${root}?from=2026-10-20&to=2026-10-26`);
    assert.equal(history.body.assessments.find((a) => a.id === original.id).status, 'void');
    assert.equal(
      history.body.assessments.find((a) => a.id === final.body.assessment.id).status,
      'final',
    );
    report.checks.push('discarded correction can be retried; original voided with history');
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.stage = stage;
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await api.dispose();
  await writeFile(
    'docs/evidencias/t17-correction-review.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.info(JSON.stringify(report));
}
