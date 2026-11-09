import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import sharp from 'sharp';
import { PrivateStorage } from './storage.js';
import { problem } from './problems.js';
import type { AppConfig } from './app.js';
export async function registerPwa(app: FastifyInstance, pool: Pool, config: AppConfig) {
  const storage = new PrivateStorage(
    config.storageRoot ?? process.env.STORAGE_PATH ?? '.local/storage',
  );
  const params = {
    type: 'object',
    required: ['slug'],
    properties: { slug: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{2,39}$' } },
  };
  async function brand(slug: string) {
    const b = (await pool.query('SELECT app.public_brand($1) data', [slug])).rows[0]?.data;
    if (!b) throw problem(404, 'ORGANIZATION_NOT_FOUND', 'No se encontró el estudio.');
    return b;
  }
  app.get<{ Params: { slug: string } }>(
    '/v1/public/studios/:slug/manifest.webmanifest',
    { schema: { params } },
    async (req, reply) => {
      const b = await brand(req.params.slug),
        path = `/v1/public/studios/${b.slug}`,
        icon = (size: number) => ({
          src: `${path}/app-icon.png?size=${size}&v=${b.logoId ?? 'initial'}`,
          sizes: `${size}x${size}`,
          type: 'image/png',
          purpose: size === 512 ? 'any maskable' : 'any',
        });
      return reply
        .header('Content-Type', 'application/manifest+json; charset=utf-8')
        .header('Cache-Control', 'public, max-age=60')
        .send({
          id: `/app-id/${b.id}`,
          name: b.name,
          short_name: b.name.slice(0, 25),
          description: 'Tu entrenamiento, tu progreso y tu coach.',
          lang: 'es',
          start_url: `/abrir/${b.slug}`,
          scope: '/',
          display: 'standalone',
          background_color: '#071022',
          theme_color: b.accent,
          icons: [icon(192), icon(512)],
          shortcuts: [
            { name: 'Entrenar', url: `/abrir/${b.slug}?to=entrenar` },
            { name: 'Mi progreso', url: `/abrir/${b.slug}?to=progreso` },
          ],
        });
    },
  );
  app.get<{ Params: { slug: string }; Querystring: { size?: number; v?: string } }>(
    '/v1/public/studios/:slug/app-icon.png',
    {
      schema: {
        params,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            size: { type: 'integer', enum: [180, 192, 512], default: 192 },
            v: { type: 'string', maxLength: 40 },
          },
        },
      },
    },
    async (req, reply) => {
      const b = await brand(req.params.slug),
        size = req.query.size ?? 192,
        color = /^#[\da-f]{6}$/i.test(b.accent) ? b.accent : '#005ea8';
      let logo: Buffer | undefined;
      const key = (await pool.query('SELECT app.public_logo($1) key', [b.slug])).rows[0]?.key;
      if (key) {
        try {
          logo = await sharp(await storage.read(key))
            .resize(Math.round(size * 0.6), Math.round(size * 0.6), { fit: 'inside' })
            .png()
            .toBuffer();
        } catch {
          /* Initial remains available if a logo is unavailable. */
        }
      }
      const initial = (String(b.name).match(/[\p{L}\p{N}]/u)?.[0] ?? 'F').toUpperCase(),
        rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)),
        ink = rgb[0]! * 299 + rgb[1]! * 587 + rgb[2]! * 114 > 160000 ? '#071022' : '#ffffff',
        canvas = sharp({ create: { width: size, height: size, channels: 4, background: color } });
      const text = Buffer.from(
        `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(size * 0.48)}" font-weight="700" fill="${ink}">${initial}</text></svg>`,
      );
      const bytes = await canvas
        .composite(logo ? [{ input: logo, gravity: 'centre' }] : [{ input: text }])
        .png()
        .toBuffer();
      return reply
        .header('Content-Type', 'image/png')
        .header('Cache-Control', 'public, max-age=60')
        .send(bytes);
    },
  );
}
