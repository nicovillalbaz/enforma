import { test, expect } from '@playwright/test';
import { workoutFixture } from './workout-fixture';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, sep, basename } from 'node:path';
async function removeOwnedBrowser(directory: string, root: string) {
  if (!directory.startsWith(root + sep) || !basename(directory).startsWith('t05-'))
    throw new Error('Unexpected browser temporary path');
  await rm(directory, { recursive: true, force: true });
}
test('T05 durable offline sets and reload; Chromium also restarts a persistent browser', async ({
  browser,
  request,
  baseURL,
}, info) => {
  const root = resolve('.local/browser-tests');
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(resolve(root, 't05-'));
  const coldRestart = info.project.name === 'offline-chromium';
  if (!coldRestart)
    info.annotations.push({
      type: 'coverage-limit',
      description:
        'WebKit Windows: in-place offline reload only; cold CacheStorage restart is an open physical gate, see t05-webkit-diagnostic.json.',
    });
  let active = coldRestart
    ? await browser
        .browserType()
        .launchPersistentContext(directory, { baseURL, viewport: { width: 390, height: 844 } })
    : await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const f = await workoutFixture(request, browser, baseURL!, info.project.name, active),
    page = await active.newPage();
  try {
    await page.goto(f.preparePath);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise<void>((resolve) =>
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
            once: true,
          }),
        );
    });
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page.getByText('Todos los cambios confirmados por el servidor')).toBeVisible();
    await f.context.setOffline(true);
    for (const [kg, reps] of [
      ['42.5', '9'],
      ['45', '8'],
    ]) {
      await page.getByLabel('Carga (kg, opcional)', { exact: true }).fill(kg!);
      await page.getByLabel('Repeticiones', { exact: true }).fill(reps!);
      await page.getByRole('button', { name: 'Guardar serie', exact: true }).click();
    }
    await expect(
      page.getByText('2 cambio(s) guardados en este dispositivo', { exact: false }),
    ).toBeVisible();
    const before = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const q = indexedDB.open('forma.workouts.v1');
        q.onsuccess = () => res(q.result);
        q.onerror = () => rej(q.error);
      });
      return new Promise<{ restDeadline: number }>((resolve) => {
        const q = db.transaction('sessions').objectStore('sessions').getAll();
        q.onsuccess = () => resolve(q.result[0]);
      });
    });
    await page.reload();
    await expect(
      page.getByText('2 cambio(s) guardados en este dispositivo', { exact: false }),
    ).toBeVisible();
    await expect(page.getByText('2 de 3 series registradas')).toBeVisible();
    // Close the entire browser process and reopen its persistent profile with no network.
    let restored = page;
    if (coldRestart) {
      await active.close();
      active = await browser.browserType().launchPersistentContext(directory, {
        baseURL,
        viewport: { width: 390, height: 844 },
        offline: true,
      });
      restored = active.pages()[0] ?? (await active.newPage());
      await restored.goto('/entrenar');
      await expect(restored.getByText('2 de 3 series registradas')).toBeVisible();
    }
    const cacheKeys = await restored.evaluate(async () => {
      const paths: string[] = [];
      for (const name of await caches.keys())
        for (const request of await (await caches.open(name)).keys())
          paths.push(new URL(request.url).pathname);
      return paths;
    });
    expect(cacheKeys.some((p) => p.startsWith('/v1/'))).toBe(false);
    expect(cacheKeys.some((p) => p.endsWith('.js'))).toBe(true);
    expect(before.restDeadline).toBeGreaterThan(0);
    await active.setOffline(false);
    await expect(restored.getByText('Todos los cambios confirmados por el servidor')).toBeVisible({
      timeout: 30000,
    });
    const summary = (
      await (await request.get(f.root + `/workouts?studentId=${f.student.id}`)).json()
    ).sessions[0];
    expect(summary.sets.filter((s: { state: string }) => s.state === 'recorded')).toHaveLength(2);
    expect(summary.sets[0].actual.weightKg).toBe(42.5);
    expect(summary.sets[1].actual.reps).toBe(8);
    expect(summary.sets[0].revision).toBe(1);
    await restored.getByRole('button', { name: 'Actualizar acceso', exact: true }).click();
    await expect(restored.getByText('Contexto sin conexión', { exact: false })).toHaveCount(0);
    await restored.getByRole('link', { name: 'Mi plan', exact: true }).last().click();
    await expect(restored).toHaveURL(/\/mi-programa/);
  } finally {
    await active.close();
    await removeOwnedBrowser(directory, root);
  }
});
test('T05 local storage failure never acknowledges or sends an unpersisted series', async ({
  browser,
  request,
  baseURL,
}, info) => {
  const f = await workoutFixture(request, browser, baseURL!, info.project.name),
    page = await f.context.newPage();
  try {
    await page.goto(f.preparePath);
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page.getByText('Todos los cambios confirmados por el servidor')).toBeVisible();
    await page.evaluate(() => {
      IDBObjectStore.prototype.put = function () {
        throw new DOMException(
          'Espacio agotado: no se guardó en el dispositivo.',
          'QuotaExceededError',
        );
      };
    });
    await page.getByLabel('Repeticiones', { exact: true }).fill('10');
    await page.getByRole('button', { name: 'Guardar serie', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('no se guardó');
    await expect(page.getByLabel('Repeticiones', { exact: true })).toHaveValue('10');
    const server = (
      await (await f.context.request.get(f.root + `/workouts/${f.session.id}`)).json()
    ).session;
    expect(server.sets.every((s: { state: string }) => s.state === 'pending')).toBe(true);
  } finally {
    await f.context.close();
  }
});

test('T05 cancellation preserves blocked local facts, export and explicit offline logout purges the account', async ({
  browser,
  request,
  baseURL,
}, info) => {
  const f = await workoutFixture(request, browser, baseURL!, info.project.name),
    page = await f.context.newPage();
  try {
    await page.goto(f.preparePath);
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(page.getByText('Todos los cambios confirmados por el servidor')).toBeVisible();
    await f.context.setOffline(true);
    await page.getByLabel('Repeticiones', { exact: true }).fill('10');
    await page.getByRole('button', { name: 'Guardar serie', exact: true }).click();
    await expect(
      page.getByText('1 cambio(s) guardados en este dispositivo', { exact: false }),
    ).toBeVisible();
    const cancelled = await request.post(
      f.root + `/program-assignments/${f.assignment.id}/cancel`,
      { headers: f.headers, data: { revision: 1, reason: 'Cancelación de prueba' } },
    );
    expect(cancelled.ok()).toBe(true);
    await f.context.setOffline(false);
    await expect(
      page.getByText('Una asignación cancelada no admite nuevos cambios.', { exact: false }),
    ).toBeVisible({ timeout: 20000 });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar registros pendientes', exact: true }).click();
    expect((await download).suggestedFilename()).toContain('forma-registros-');
    const server = (await (await request.get(f.root + `/workouts/${f.session.id}`)).json()).session;
    expect(server.sets.every((s: { state: string }) => s.state === 'pending')).toBe(true);
    await f.context.setOffline(true);
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).last().click();
    await expect(
      page.getByText('1 cambio(s) guardados en este dispositivo', { exact: false }),
    ).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).last().click();
    await expect(page).toHaveURL(/\/acceso/);
    expect(
      await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve) => {
          const r = indexedDB.open('forma.workouts.v1');
          r.onsuccess = () => resolve(r.result);
        });
        return new Promise<number>((resolve) => {
          const r = db.transaction('sessions').objectStore('sessions').count();
          r.onsuccess = () => resolve(r.result);
        });
      }),
    ).toBe(0);
    await f.context.setOffline(false);
    await page.reload();
    expect((await f.context.request.get('/v1/auth/me')).status()).toBe(401);
    expect(await page.evaluate(() => localStorage.getItem('forma.logout.pending'))).toBeNull();
  } finally {
    await f.context.close();
  }
});
