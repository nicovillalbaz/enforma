import { approveBrowserCoach } from './coach-approval';
import { test, expect } from '@playwright/test';
import sharp from 'sharp';
test.use({ actionTimeout: 15000 });
test('two public brands keep their own color and logo; platform admin works at mobile widths', async ({
  page,
  request,
}, info) => {
  const token = (await (await request.get('/v1/security/csrf')).json()).token;
  const headers = { 'x-csrf-token': token };
  const fixtureId = `brand-${info.project.name}-${Date.now().toString(36)}`;
  expect(
    (
      await request.post('/v1/auth/register-coach', {
        headers,
        data: {
          email: `${fixtureId}@example.test`,
          password: 'Brand-password-2026!',
          fullName: 'Coach Visual',
          name: 'Estudio Visual',
          slug: fixtureId,
          kind: 'coach',
          accent: '#005ea8',
          plan: 'basic',
          privacyAccepted: true,
        },
      })
    ).status(),
  ).toBe(201);
  const fixtures = [];
  for (const [index, color] of ['#7055bc', '#1d7655'].entries()) {
    const slug = `visual-${info.project.name}-${index}-${Date.now().toString(36)}`;
    const name = `Marca visual ${index + 1}`;
    const response = await request.post('/v1/organizations', {
      headers,
      data: { name, slug, kind: 'coach', accent: color, plan: 'basic' },
    });
    expect(response.status()).toBe(201);
    const { organizationId } = await response.json();
    await approveBrowserCoach(request, organizationId);
    const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: color } })
      .png()
      .toBuffer();
    expect(
      (
        await request.post(`/v1/organizations/${organizationId}/branding/logo`, {
          headers,
          data: { dataUrl: `data:image/png;base64,${image.toString('base64')}` },
        })
      ).ok(),
    ).toBe(true);
    fixtures.push({ name, slug, color });
  }
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const fixture of fixtures) {
      await page.goto(`/estudio/${fixture.slug}`);
      await expect(page.locator('.login-form .brand strong')).toHaveText(fixture.name);
      await expect(page.locator('.brand-mark img')).toHaveAttribute(
        'src',
        new RegExp(`^/v1/public/studios/${fixture.slug}/logo\\?v=`),
      );
      await expect
        .poll(() =>
          page
            .locator('.brand-mark img')
            .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
        )
        .toBe(true);
      expect(
        await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--brand').trim(),
        ),
      ).toBe(fixture.color);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  }
  await page.goto('/acceso');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('admin@forma.local');
  await page.getByLabel('Contraseña', { exact: true }).fill('Forma-demo-2026!');
  await page.getByRole('button', { name: 'Entrar a mi espacio' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Coaches y acceso', exact: true })).toBeVisible();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
