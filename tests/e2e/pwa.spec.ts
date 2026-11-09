import { approveBrowserCoach } from './coach-approval';
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { workoutFixture } from './workout-fixture';
test('T07 brand installation launch selects its study and keeps mobile layout and zoom', async ({
  browser,
  request,
  page,
  baseURL,
}, info) => {
  const f = await workoutFixture(request, browser, baseURL!, 'PWA ' + info.project.name),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const org = (await (await request.get('/v1/organizations')).json()).organizations.find(
      (o: { id: string }) => f.root.includes(o.id),
    );
    const other = await request.post('/v1/organizations', {
      headers: f.headers,
      data: {
        name: 'Otra marca PWA',
        slug: 'pwa-' + randomUUID().slice(0, 8),
        kind: 'coach',
        accent: '#8c2464',
        plan: 'basic',
      },
    });
    expect(other.status(), await other.text()).toBe(201);
    const otherId = (await other.json()).organizationId;
    await approveBrowserCoach(request, otherId);
    await page.context().addCookies((await request.storageState()).cookies);
    await page.goto('/');
    await page
      .getByLabel(
        info.project.name === 'desktop' ? 'Seleccionar estudio' : 'Cambiar estudio en móvil',
      )
      .selectOption(otherId);
    await expect(page.locator('.breadcrumb-brand')).toContainText('Otra marca PWA');
    const otherOrg = (await (await request.get('/v1/organizations')).json()).organizations.find(
      (o: { id: string }) => o.id === otherId,
    );
    await page.goto('/estudio/' + otherOrg.slug);
    await expect(page.locator('link[rel=manifest]')).toHaveAttribute(
      'href',
      new RegExp(otherOrg.slug),
    );
    await page.goto('/abrir/' + org.slug);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.breadcrumb-brand')).toContainText(org.name);
    await page.goto('/instalar');
    await expect(
      page.getByRole('heading', { name: 'Tu estudio en la pantalla de inicio.' }),
    ).toBeVisible();
    const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestUrl).toContain(org.slug);
    const manifest = await (await request.get(manifestUrl!)).json();
    expect(manifest).toMatchObject({
      id: `/app-id/${org.id}`,
      start_url: `/abrir/${org.slug}`,
      display: 'standalone',
    });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `install ${width}`,
      ).toBe(true);
    }
    expect(await page.locator('meta[name=viewport]').getAttribute('content')).not.toMatch(
      /maximum-scale|user-scalable=no/,
    );
    await page.screenshot({
      path: `docs/evidencias/t07-${info.project.name}-instalar-pc.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `docs/evidencias/t07-${info.project.name}-instalar-movil.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  } finally {
    await f.context.close();
  }
});
