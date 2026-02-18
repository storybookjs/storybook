import { timingSafeEqual } from 'node:crypto';

/**
 * Validates a secret token using constant-time comparison to prevent timing attacks.
 *
 * @returns `true` if tokens match, `false` otherwise
 */
export function isValidToken(token: string | null, expectedToken: string): boolean {
  if (!token || !expectedToken) {
    return false;
  }

  const a = Buffer.from(token, 'utf8');
  const b = Buffer.from(expectedToken, 'utf8');
  try {
    // TODO: Remove any types as soon as @types/node is updated
    return a.length === b.length && timingSafeEqual(a as any, b as any);
  } catch {
    return false;
  }
}
