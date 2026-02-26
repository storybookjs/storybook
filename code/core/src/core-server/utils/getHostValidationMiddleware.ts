import type { IncomingMessage } from 'node:http';

import { isHostAllowed } from 'host-validation-middleware';

import type { Middleware } from '../../types';

// TODO: Change to `[]` in SB11 to change from opt-in to opt-out
export const DEFAULT_ALLOWED_HOSTS: string[] | true = true;

export type HostValidationOptions = {
  host?: string;
  allowedHosts?: string[] | true;
  localAddress?: string;
  networkAddress?: string;
};

/**
 * Validates a host (Host header–shaped string, e.g. "localhost:6006") against known local/network
 * addresses and allowed hosts. Callers must pass host-shaped input; normalize from an origin URL
 * (e.g. new URL(origin).host) before invoking if needed.
 *
 * @param host - The host to validate (hostname or "hostname:port").
 * @param options - The builder options.
 * @returns `true` if the host is valid, `false` otherwise.
 */
export const isValidHost = (host: string | undefined, options: HostValidationOptions): boolean => {
  const allowedHosts = options.allowedHosts || DEFAULT_ALLOWED_HOSTS;
  if (allowedHosts === true) {
    return true;
  }
  if (!host) {
    return false;
  }

  try {
    // Setting host to 0.0.0.0 binds to all hosts, which implies allowing all hosts.
    // This is common in containerized environments like Docker.
    if (options.host === '0.0.0.0' && allowedHosts.length === 0) {
      return true;
    }
    return isHostAllowed(host, [
      ...allowedHosts,
      ...(options.localAddress ? [new URL(options.localAddress).host] : []),
      ...(options.networkAddress ? [new URL(options.networkAddress).host] : []),
    ]);
  } catch {
    return false;
  }
};

/**
 * Validates the Host header against known local/network addresses and allowed hosts. Requests with
 * no Host header (e.g. same-origin navigation, GET from address bar) are not allowed.
 */
export function getHostValidationMiddleware(
  options: HostValidationOptions
): Middleware<IncomingMessage> {
  return (req, res, next) => {
    const host = req.headers.host;
    const allowedHosts = options.allowedHosts || DEFAULT_ALLOWED_HOSTS;
    if (allowedHosts !== true && !isValidHost(host, options)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Invalid host');
      return;
    }
    next();
  };
}
