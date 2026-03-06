// Copied from https://github.com/sapphi-red/host-validation-middleware in order to avoid ESM issues

import net from 'node:net';

const cache = new WeakMap<readonly string[], Set<string>>();

/**
 * Check if the host contained in the host header is allowed.
 *
 * This function will cache the result if the `allowedHosts` array is frozen.
 *
 * @param hostHeader - The value of host header. See [RFC 9110 7.2](https://datatracker.ietf.org/doc/html/rfc9110#name-host-and-authority).
 * @param allowedHosts - The allowed host patterns. See the README for more details.
 */
export function isHostAllowed(
  hostHeader: string | undefined,
  allowedHosts: readonly string[]
): boolean {
  if (hostHeader === undefined) {
    return true;
  }

  let cachedAllowedHosts: Set<string> | undefined;
  if (Object.isFrozen(allowedHosts)) {
    if (!cache.has(allowedHosts)) {
      cache.set(allowedHosts, new Set());
    }

    cachedAllowedHosts = cache.get(allowedHosts)!;
    if (cachedAllowedHosts.has(hostHeader)) {
      return true;
    }
  }

  const result = isHostAllowedInternal(hostHeader, allowedHosts);
  if (cachedAllowedHosts && result) {
    cachedAllowedHosts.add(hostHeader);
  }
  return result;
}

const isFileOrExtensionProtocolRE = /^(?:file|.+-extension):/i;

// Based on webpack-dev-server's `checkHeader` function: https://github.com/webpack/webpack-dev-server/blob/v5.2.0/lib/Server.js#L3086
// https://github.com/webpack/webpack-dev-server/blob/v5.2.0/LICENSE
function isHostAllowedInternal(hostHeader: string, allowedHosts: readonly string[]): boolean {
  if (isFileOrExtensionProtocolRE.test(hostHeader)) {
    return true;
  }

  const extracted = extractHostNameFromHostHeader(hostHeader);
  if (extracted.type === 'invalid') {
    return false;
  }

  // DNS rebinding attacks does not happen with IP addresses
  if (extracted.type === 'ipv4' || extracted.type === 'ipv6') {
    return true;
  }

  const hostname = extracted.value;

  // allow localhost and .localhost by default as they always resolve to the loopback address
  // https://datatracker.ietf.org/doc/html/rfc6761#section-6.3
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return true;
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const allowedHost of allowedHosts) {
    if (allowedHost === hostname) {
      return true;
    }

    // allow all subdomains of it
    // e.g. `.foo.example` will allow `foo.example`, `*.foo.example`, `*.*.foo.example`, etc
    if (
      allowedHost[0] === '.' &&
      (allowedHost.slice(1) === hostname || hostname.endsWith(allowedHost))
    ) {
      return true;
    }
  }

  return false;
}

type Result =
  | { type: 'invalid' }
  | { type: 'ipv6' }
  | { type: 'ipv4' }
  | { type: 'hostname'; value: string };

/**
 * This function assumes that the input is not malformed.
 * This is because we only care about browser requests.
 * Non-browser clients can send any value they want anyway.
 */
function extractHostNameFromHostHeader(hostHeader: string): Result {
  // `Host = uri-host [ ":" port ]`
  const trimmedHost = hostHeader.trim();

  // IPv6
  if (trimmedHost[0] === '[') {
    const endIpv6 = trimmedHost.indexOf(']');
    if (endIpv6 < 0) {
      return { type: 'invalid' };
    }
    return net.isIP(trimmedHost.slice(1, endIpv6)) === 6 ? { type: 'ipv6' } : { type: 'invalid' };
  }

  // uri-host does not include ":" unless IPv6 address
  const colonPos = trimmedHost.indexOf(':');
  const hostname = colonPos === -1 ? trimmedHost : trimmedHost.slice(0, colonPos);

  if (net.isIP(hostname) === 4) {
    return { type: 'ipv4' };
  }

  return { type: 'hostname', value: hostname };
}
