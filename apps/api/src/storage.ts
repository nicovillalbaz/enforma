import { mkdir, writeFile, readFile, rename, open, unlink, lstat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export class PrivateStorage {
  constructor(
    private root: string,
    private limit = 10 * 1024 * 1024,
  ) {}
  private path(key: string) {
    if (!/^[a-zA-Z0-9/_-]+\.[a-z0-9]+$/.test(key)) throw new Error('Invalid storage key');
    const root = resolve(this.root);
    const path = resolve(root, key);
    if (!path.startsWith(`${root}${sep}`)) throw new Error('Invalid storage key');
    return path;
  }
  async put(bytes: Uint8Array, extension: 'bin' | 'jpg' | 'mp4' | 'pdf' | 'webp' = 'bin') {
    if (bytes.byteLength > this.limit) throw new Error('Storage limit exceeded');
    await mkdir(this.root, { recursive: true });
    const key = `${randomUUID()}.${extension}`;
    const path = this.path(key);
    await writeFile(`${path}.pending`, bytes, { flag: 'wx', mode: 0o600 });
    await rename(`${path}.pending`, path);
    return key;
  }
  async read(key: string) {
    await this.info(key);
    return readFile(this.path(key));
  }
  async info(key: string) {
    const path = this.path(key);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Invalid storage file');
    return { path, size: stat.size };
  }
  async remove(key: string) {
    try {
      await this.info(key);
      await unlink(this.path(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
  async putStream(source: AsyncIterable<Uint8Array>, expectedBytes: number) {
    if (expectedBytes < 1 || expectedBytes > this.limit) throw new Error('Storage limit exceeded');
    await mkdir(this.root, { recursive: true });
    const key = `${randomUUID()}.bin`;
    const path = this.path(key);
    const pending = `${path}.pending`;
    const file = await open(pending, 'wx', 0o600);
    let count = 0;
    const hash = createHash('sha256');
    try {
      for await (const chunk of source) {
        count += chunk.byteLength;
        if (count > expectedBytes) throw new Error('Storage limit exceeded');
        hash.update(chunk);
        await file.writeFile(chunk);
      }
      if (count !== expectedBytes) throw new Error('Incomplete upload');
      await file.close();
      await rename(pending, path);
      return { key, bytes: count, hash: hash.digest('hex') };
    } catch (e) {
      await file.close().catch(() => {});
      await unlink(pending).catch(() => {});
      throw e;
    }
  }
}
