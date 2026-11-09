import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

export const generateToken = () => randomBytes(32).toString('base64url');
export const tokenDigest = (value: string) => createHash('sha256').update(value).digest('hex');
export const hashPassword = (value: string) =>
  hash(value, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
export const verifyPassword = (digest: string, value: string) => verify(digest, value);
export function equalTokens(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
