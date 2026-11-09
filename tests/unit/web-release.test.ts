import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { inspectWebRelease, writeWebRelease } from '../../scripts/web-release.js';
const directories: string[] = [];
async function fixture() {
  const base = resolve('.local/test-builds');
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, 'release-'));
  directories.push(root);
  for (const directory of ['apps/web', 'packages/ui', 'packages/shared', 'scripts', 'dist/web'])
    await mkdir(join(root, directory), { recursive: true });
  for (const [name, value] of Object.entries({
    'package.json': '{"version":"0.14.0"}',
    'package-lock.json': '{}',
    'tsconfig.base.json': '{}',
    'scripts/build-offline-shell.mjs': '// build',
    'scripts/web-release.ts': '// provenance',
    'apps/web/main.ts': 'initial',
    'packages/shared/value.ts': 'initial',
    'dist/web/index.html': 'initial',
    'dist/web/sw.js': 'initial',
  }))
    await writeFile(join(root, name), value);
  await writeWebRelease(root);
  return root;
}
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (!resolve(directory).startsWith(resolve('.local/test-builds') + sep))
      throw new Error('Unsafe fixture path');
    await rm(directory, { recursive: true, force: true });
  }
});
it('rejects a stale web build after a shared source changes, while docs do not require a rebuild', async () => {
  const root = await fixture();
  expect((await inspectWebRelease(root)).status).toBe('verified');
  await writeFile(join(root, 'apps/web/README.md'), 'Documentation only');
  expect((await inspectWebRelease(root)).status).toBe('verified');
  await writeFile(join(root, 'packages/shared/value.ts'), 'changed');
  expect(await inspectWebRelease(root)).toMatchObject({
    status: 'mismatch',
    sourceCurrent: false,
    artifactsIntact: true,
  });
});
it('detects modified output of the same length and a missing build manifest', async () => {
  const root = await fixture();
  await writeFile(join(root, 'dist/web/sw.js'), 'changed');
  expect(await inspectWebRelease(root)).toMatchObject({
    status: 'mismatch',
    sourceCurrent: true,
    artifactsIntact: false,
  });
  await rm(join(root, 'dist/release-manifest.json'));
  expect((await inspectWebRelease(root)).status).toBe('unavailable');
});
