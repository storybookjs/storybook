import { timingSafeEqual } from 'node:crypto';

import type { BuilderOptions } from 'storybook/internal/types';

// TODO: Change to `[]` in SB11 to change from opt-in to opt-out
const DEFAULT_ALLOWED_HOSTS: string[] = ['*'];

/**
 * Validates a request origin against known local/network addresses and allowed hosts.
 *
 * @param requestOrigin - The origin header value to validate.
 * @param options - The builder options.
 * @returns `true` if the origin is valid, `false` otherwise.
 */
export const isValidOrigin = (
  requestOrigin: string | undefined,
  { allowedHosts = DEFAULT_ALLOWED_HOSTS, localAddress, networkAddress }: BuilderOptions
): boolean => {
  if (allowedHosts.includes('*')) {
    return true;
  }
  if (!requestOrigin) {
    return false;
  }

  try {
    const requestUrl = new URL(requestOrigin);
    const localUrl = localAddress && new URL(localAddress);
    const networkUrl = networkAddress && new URL(networkAddress);

    if (localUrl && localUrl.origin === requestUrl.origin) {
      return true;
    }
    if (networkUrl && networkUrl.origin === requestUrl.origin) {
      return true;
    }

    return allowedHosts.includes(requestUrl.hostname);
  } catch {
    return false;
  }
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

  const a = new Uint8Array(Buffer.from(token, 'utf8'));
  const b = new Uint8Array(Buffer.from(expectedToken, 'utf8'));
  try {
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
