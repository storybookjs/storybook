// Each entry must be a valid CSP host source, so IP ranges and IPv6 literals cannot be listed.
export const LOOPBACK_HOSTNAMES = ['localhost', '*.localhost', '127.0.0.1'];

export const matchesHostname = (hostname: string, patterns: string[]): boolean =>
  patterns.some((pattern) =>
    pattern.startsWith('*.') ? hostname.endsWith(pattern.slice(1)) : hostname === pattern
  );
