import { timingSafeEqual } from 'node:crypto';

export type ValidateWebSocketOptions = {
  token: string;
  host?: string;
  allowedHosts?: string[] | true;
  localAddress?: string;
  networkAddress?: string;
};

// TODO: Change to `[]` in SB11 to change from opt-in to opt-out
const DEFAULT_ALLOWED_HOSTS: string[] | true = true;

/**
 * Validates a request origin against known local/network addresses and allowed hosts.
 *
 * @param requestOrigin - The origin header value to validate.
 * @param options - The builder options.
 * @returns `true` if the origin is valid, `false` otherwise.
 */
export const isValidOrigin = (
  requestOrigin: string | undefined,
  options: ValidateWebSocketOptions
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
    return allowedHosts.some((host) =>
      host.includes(':') ? host === requestUrl.host : host === requestUrl.hostname
    );
  } catch {
    return false;
  }
};

/**
 * Validates a secret token using constant-time comparison to prevent timing attacks.
 *
 * @returns `true` if tokens match, `false` otherwise
 */
export function isValidToken(
  requestToken: string | null,
  options: ValidateWebSocketOptions
): boolean {
  if (!requestToken || !options.token) {
    return false;
  }

  const a = new Uint8Array(Buffer.from(requestToken, 'utf8'));
  const b = new Uint8Array(Buffer.from(options.token, 'utf8'));
  try {
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
