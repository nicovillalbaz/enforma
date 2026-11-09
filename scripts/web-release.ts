// Local build provenance only: never reads .env, business data or private storage.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

async function files(root: string, path = '', source = true): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
    if (
      source &&
      (['node_modules', 'dist', '.local', '.git'].includes(entry.name) ||
        entry.name.startsWith('.env') ||
        entry.name.endsWith('.tsbuildinfo') ||
        entry.name.endsWith('.md'))
    )
      continue;
    const relative = path ? path + '/' + entry.name : entry.name;
    if (entry.isDirectory()) result.push(...(await files(root, relative, source)));
    else if (entry.isFile()) result.push(relative);
    else throw new Error('Build input must be a regular file or directory');
  }
  return result.sort();
}
async function digest(root: string, paths: string[]) {
  const hash = createHash('sha256');
  for (const path of paths.sort()) {
    const bytes = await readFile(join(root, path));
    hash.update(path).update('\0').update(createHash('sha256').update(bytes).digest()).update('\0');
  }
  return { digest: hash.digest('hex'), files: paths.length };
}
export async function webSourceDigest(root = process.cwd()) {
  const paths = [
    'package.json',
    'package-lock.json',
    'tsconfig.base.json',
    'scripts/build-offline-shell.mjs',
    'scripts/web-release.ts',
  ];
  for (const folder of ['apps/web', 'packages/ui', 'packages/shared'])
    paths.push(...(await files(join(root, folder))).map((path) => folder + '/' + path));
  return digest(root, paths);
}
export async function webArtifactDigest(root = process.cwd()) {
  const directory = join(root, 'dist/web');
  return digest(directory, await files(directory, '', false));
}
export async function writeWebRelease(root = process.cwd()) {
  const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version as string;
  const manifest = {
    format: 1,
    version,
    builtAt: new Date().toISOString(),
    nodeVersion: process.versions.node,
    sources: await webSourceDigest(root),
    artifacts: await webArtifactDigest(root),
  };
  await writeFile(
    join(root, 'dist/release-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  return manifest;
}
export async function inspectWebRelease(root = process.cwd()) {
  try {
    const manifest = JSON.parse(
      await readFile(join(resolve(root), 'dist/release-manifest.json'), 'utf8'),
    ) as Awaited<ReturnType<typeof writeWebRelease>>;
    if (
      manifest.format !== 1 ||
      !/^[a-f0-9]{64}$/.test(manifest.sources?.digest) ||
      !/^[a-f0-9]{64}$/.test(manifest.artifacts?.digest)
    )
      throw new Error('Invalid build manifest');
    const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
    const sources = await webSourceDigest(root),
      artifacts = await webArtifactDigest(root);
    const checks = {
      versionMatches: manifest.version === version,
      sourceCurrent:
        manifest.sources.digest === sources.digest && manifest.sources.files === sources.files,
      artifactsIntact:
        manifest.artifacts.digest === artifacts.digest &&
        manifest.artifacts.files === artifacts.files,
    };
    return {
      status: Object.values(checks).every(Boolean) ? 'verified' : 'mismatch',
      ...checks,
      builtAt: manifest.builtAt,
      version: manifest.version,
      sourceFiles: sources.files,
      artifactFiles: artifacts.files,
      sourceDigest: sources.digest,
      artifactDigest: artifacts.digest,
    };
  } catch {
    return {
      status: 'unavailable',
      versionMatches: false,
      sourceCurrent: false,
      artifactsIntact: false,
    };
  }
}
