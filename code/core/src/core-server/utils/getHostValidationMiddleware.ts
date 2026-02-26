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
 * Validates the Host header against known local/network addresses and allowed hosts. Requests with
 * no Host header (e.g. same-origin navigation, GET from address bar) are not allowed.
 */
export function getHostValidationMiddleware(
  options: HostValidationOptions
): Middleware<IncomingMessage> {
  return (req, res, next) => {
    const host = req.headers.host;
    const allowedHosts = options.allowedHosts || DEFAULT_ALLOWED_HOSTS;
    if (allowedHosts !== true && (!host || !isHostAllowed(host, allowedHosts))) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Invalid origin');
      return;
    }
    next();
  };
}
