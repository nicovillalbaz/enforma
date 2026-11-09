import { describe, expect, it } from 'vitest';
import {
  generateToken,
  tokenDigest,
  hashPassword,
  verifyPassword,
  equalTokens,
} from '../../apps/api/src/security.js';
describe('identity primitives', () => {
  it('hashes passwords with Argon2 and rejects a different password', async () => {
    const digest = await hashPassword('private-password-123');
    expect(digest).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(digest, 'private-password-123')).toBe(true);
    expect(await verifyPassword(digest, 'wrong')).toBe(false);
  });
  it('uses random opaque tokens and stable irreversible digests', () => {
    const a = generateToken(),
      b = generateToken();
    expect(a).not.toBe(b);
    expect(tokenDigest(a)).toHaveLength(64);
    expect(tokenDigest(a)).not.toContain(a);
    expect(equalTokens(a, a)).toBe(true);
    expect(equalTokens(a, b)).toBe(false);
    expect(equalTokens('x', 'longer')).toBe(false);
  });
});
