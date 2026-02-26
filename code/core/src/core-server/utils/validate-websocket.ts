import { timingSafeEqual } from 'node:crypto';

import { isHostAllowed } from 'host-validation-middleware';

import { DEFAULT_ALLOWED_HOSTS, type HostValidationOptions } from './getHostValidationMiddleware';

/**
 * Validates a request Origin against known local/network addresses and allowed hosts.
 *
 * @param requestOrigin - The origin header value to validate.
 * @param options - The builder options.
 * @returns `true` if the origin is valid, `false` otherwise.
 */
export const isValidOrigin = (
  requestOrigin: string | undefined,
  options: HostValidationOptions
): boolean => {
  const allowedHosts = options.allowedHosts || DEFAULT_ALLOWED_HOSTS;
  if (allowedHosts === true) {
    return true;
  }
  if (!requestOrigin) {
    return false;
  }

  try {
    const requestUrl = new URL(requestOrigin);
    const localUrl = options.localAddress && new URL(options.localAddress);
    const networkUrl = options.networkAddress && new URL(options.networkAddress);

    if (localUrl && localUrl.origin === requestUrl.origin) {
      return true;
    }
    if (networkUrl && networkUrl.origin === requestUrl.origin) {
      return true;
    }
    if (options.host === '0.0.0.0' && allowedHosts.length === 0) {
      return true;
    }
    return isHostAllowed(requestUrl.host, allowedHosts);
  } catch {
    return false;
  }
};

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
