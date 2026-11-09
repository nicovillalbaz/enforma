import { afterEach, expect, it, vi } from 'vitest';
import { apiRequest, ApiClientError } from '../../apps/web/src/api.js';

afterEach(() => vi.unstubAllGlobals());

it('preserves an HTTP error when a reverse proxy returns HTML', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response('<h1>Bad gateway</h1>', { status: 502 })),
  );
  await expect(apiRequest('/v1/health')).rejects.toMatchObject({
    status: 502,
    code: 'REQUEST_ERROR',
  } satisfies Partial<ApiClientError>);
});

it('keeps a transport failure distinct from an HTTP error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
  await expect(apiRequest('/v1/health')).rejects.toMatchObject({
    status: 0,
    code: 'NETWORK_ERROR',
  } satisfies Partial<ApiClientError>);
});
