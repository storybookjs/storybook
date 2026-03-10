import { timingSafeEqual } from 'node:crypto';

/**
 * Validates a secret token using constant-time comparison to prevent timing attacks.
 *
 * @returns `true` if tokens match, `false` otherwise
 */
export function isValidToken(requestToken: string | null, expectedToken: string): boolean {
  if (!requestToken || !expectedToken) {
    return false;
  }

  const a = new Uint8Array(Buffer.from(requestToken, 'utf8'));
  const b = new Uint8Array(Buffer.from(expectedToken, 'utf8'));
  try {
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
