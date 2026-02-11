import { timingSafeEqual } from 'node:crypto';

import type { Options } from 'storybook/internal/types';

export const isValidOrigin = (
  requestOrigin: string | undefined,
  { localAddress, networkAddress }: Options
): boolean => {
  if (!requestOrigin || !localAddress) {
    return false;
  }

  const localUrl = new URL(localAddress);
  const requestUrl = new URL(requestOrigin);
  if (localUrl.origin === requestUrl.origin) {
    return true;
  }

  const networkUrl = networkAddress && new URL(networkAddress);
  if (networkUrl && networkUrl.origin === requestUrl.origin) {
    return true;
  }

  return (
    requestOrigin === `${localUrl.protocol}//localhost:${localUrl.port}` ||
    requestOrigin === `${localUrl.protocol}//127.0.0.1:${localUrl.port}`
  );
};

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
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
