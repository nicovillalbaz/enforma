import { test, expect } from '@playwright/test';
import { workoutFixture } from './workout-fixture';
test('T07 update waits with a training form open and never caches private endpoints', async ({
  browser,
  request,
  baseURL,
}, info) => {
  const f = await workoutFixture(request, browser, baseURL!, 'update-' + info.project.name),
    page = await f.context.newPage();
  try {
    await page.goto(f.preparePath);
    await page.evaluate(async () => {
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
    await page.getByLabel('Repeticiones', { exact: true }).fill('9');
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js?candidate=t07');
    });
    await expect
      .poll(() =>
        page.evaluate(async () =>
          Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
        ),
      )
      .toBe(true);
    await expect(page.locator('.pwa-update-notice')).toContainText('Nueva versión preparada');
    await expect(page.getByLabel('Repeticiones', { exact: true })).toHaveValue('9');
    expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).not.toContain(
      'candidate=t07',
    );
    const urls = await page.evaluate(async () => {
      const values: string[] = [];
      for (const key of await caches.keys())
        for (const r of await (await caches.open(key)).keys()) values.push(r.url);
      return values;
    });
    expect(urls.some((u) => u.includes('/v1/'))).toBe(false);
    expect(urls.some((u) => u.endsWith('/manifest.webmanifest'))).toBe(true);
    await page.screenshot({
      path: `docs/evidencias/t07-${info.project.name}-actualizacion.png`,
      fullPage: true,
    });
    if (info.project.name === 'offline-chromium') {
      await page.close();
      const reopened = await f.context.newPage();
      await reopened.goto('/instalar');
      await expect
        .poll(() =>
          reopened.evaluate(
            async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL,
          ),
        )
        .toContain('candidate=t07');
    } else
      info.annotations.push({
        type: 'coverage-limit',
        description:
          'Update remains waiting with form intact. Cold WebKit Windows reopening remains a physical Safari gate documented in T05.',
      });
  } finally {
    await f.context.close();
  }
});
