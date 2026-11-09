import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { expect, it } from 'vitest';
import { PrivateStorage } from '../../apps/api/src/storage.js';
it('stores opaque private files and rejects traversal or oversize', async () => {
  await mkdir('.local', { recursive: true });
  const storage = new PrivateStorage(await mkdtemp(join(resolve('.local'), 'unit-storage-')), 10);
  const key = await storage.put(Buffer.from('private'));
  expect((await storage.read(key)).toString()).toBe('private');
  await expect(storage.read('../secret.bin')).rejects.toThrow('Invalid storage key');
  await expect(storage.put(new Uint8Array(11))).rejects.toThrow('Storage limit');
});
