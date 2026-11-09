import { request as requests, expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';

export async function approveBrowserCoach(owner: APIRequestContext, organizationId: string) {
  const probe = await owner.get('/v1/auth/me');
  const origin = new URL(probe.url()).origin;
  if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname))
    throw new Error('Synthetic browser approval requires a local server');
  expect((await probe.json()).user.email).toMatch(/@example\.test$/);
  const operator = await requests.newContext({ baseURL: origin });
  try {
    const csrf = (await (await operator.get('/v1/security/csrf')).json()).token;
    const headers = { 'x-csrf-token': csrf };
    expect(
      (
        await operator.post('/v1/auth/login', {
          headers,
          data: { email: 'admin@forma.local', password: 'Forma-demo-2026!' },
        })
      ).status(),
    ).toBe(200);
    const month = new Date().toISOString().slice(0, 7);
    const current = await owner.get(
      `/v1/organizations/${organizationId}/monthly-control?month=${month}`,
    );
    expect(current.status()).toBe(200);
    const response = await operator.put(
      `/v1/admin/organizations/${organizationId}/manual-control`,
      {
        headers,
        data: {
          studentLimit: 25,
          monthlyPricePyg: null,
          accessEnabled: true,
          revision: (await current.json()).control.revision,
          requestId: randomUUID(),
          reason: 'Aprobación explícita del operador para prueba sintética',
        },
      },
    );
    expect(response.status(), await response.text()).toBe(200);
  } finally {
    await operator.dispose();
  }
}
