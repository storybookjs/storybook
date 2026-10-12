import type { IncomingMessage } from 'node:http';
import net from 'node:net';
import os from 'node:os';

import { isHostAllowed } from 'host-validation-middleware';

import { LOOPBACK_HOSTNAMES, matchesHostname } from '../../shared/utils/local-hosts';
import type { Middleware } from '../../types';

export const DEFAULT_ALLOWED_HOSTS: string[] | true = [];

export type HostValidationOptions = {
  host?: string;
  allowedHosts?: string[] | true;
  localAddress?: string;
  networkAddress?: string;
};

const stripBrackets = (hostname: string) =>
  hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

const toCanonicalIp = (value: string): string | undefined => {
  const ip = stripBrackets(value);
  const version = net.isIP(ip);
  if (!version) {
    return undefined;
  }
  try {
    return stripBrackets(new URL(version === 6 ? `http://[${ip}]` : `http://${ip}`).hostname);
  } catch {
    return undefined;
  }
};

const ifaces = os.networkInterfaces();
let ownAddresses: Set<string> | undefined;

const getOwnAddresses = () => {
  if (!ownAddresses) {
    ownAddresses = new Set<string>();
    for (const iface of Object.values(ifaces).flat()) {
      const ip = iface && toCanonicalIp(iface.address);
      if (ip) {
        ownAddresses.add(ip);
      }
    }
  }
  return ownAddresses;
};

const isOwnAddress = (ip: string) => getOwnAddresses().has(ip);

/**
 * Validates a host (Host header–shaped string, e.g. "localhost:6006") against known local/network
 * addresses and allowed hosts. Callers must pass host-shaped input; normalize from an origin URL
 * (e.g. new URL(origin).host) before invoking if needed.
 *
 * `localhost`, its subdomains and `127.0.0.1` are always allowed. Any other IP address is allowed
 * only when it is an address of this machine, the `--host` value, or listed in `allowedHosts`.
 * Hostnames must be listed in `allowedHosts`, unless they are the `--host` value.
 *
 * @param host - The host to validate (hostname or "hostname:port").
 * @param options - The builder options.
 * @returns `true` if the host is valid, `false` otherwise.
 */
export const isValidHost = (host: string | undefined, options: HostValidationOptions): boolean => {
  const allowedHosts = options.allowedHosts ?? DEFAULT_ALLOWED_HOSTS;
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

    const knownHosts = [
      ...allowedHosts,
      ...(options.host ? [options.host] : []),
      ...(options.localAddress ? [new URL(options.localAddress).hostname] : []),
      ...(options.networkAddress ? [new URL(options.networkAddress).hostname] : []),
    ];

    const { hostname } = new URL(`http://${host}`);
    if (matchesHostname(hostname, LOOPBACK_HOSTNAMES)) {
      return true;
    }

    // host-validation-middleware allows every IP address. This function also guards the Origin
    // header of WebSocket and MCP requests, so a page served from any IP address must not pass.
    const ip = toCanonicalIp(hostname);
    if (ip) {
      return knownHosts.some((known) => toCanonicalIp(known) === ip) || isOwnAddress(ip);
    }
    return isHostAllowed(host, knownHosts);
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
    const allowedHosts = options.allowedHosts ?? DEFAULT_ALLOWED_HOSTS;
    if (allowedHosts !== true && !isValidHost(host, options)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Invalid host');
      return;
    }
    next();
  };
}
