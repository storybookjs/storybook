import { describe, expect, it, vi } from 'vitest';

import { getHostValidationMiddleware, isValidHost } from '../getHostValidationMiddleware.ts';

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  const networkInterfaces = () => ({
    lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    eth0: [
      { address: '10.1.2.3', family: 'IPv4', internal: false },
      { address: 'fe80::1', family: 'IPv6', internal: false },
    ],
  });
  return { ...actual, default: { ...actual, networkInterfaces }, networkInterfaces };
});

function createMockRequest(headers: Record<string, string>) {
  return { headers } as any;
}

function createMockResponse() {
  const res: any = {
    writeHead: vi.fn(),
    end: vi.fn(),
  };
  return res;
}

describe('getHostValidationMiddleware', () => {
  it('calls next() when allowedHosts is true (allow all)', () => {
    const middleware = getHostValidationMiddleware({
      host: 'localhost',
      allowedHosts: true,
    });
    const req = createMockRequest({ host: 'malicious-site.com:6006' });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('returns 403 when Host is invalid (strict allowedHosts)', () => {
    const middleware = getHostValidationMiddleware({
      host: 'localhost',
      allowedHosts: [],
      localAddress: 'http://localhost:6006',
      networkAddress: 'http://192.168.1.100:6006',
    });
    const req = createMockRequest({ host: 'evil.com:6006' });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'text/plain' });
    expect(res.end).toHaveBeenCalledWith('Invalid host');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when Host is valid (matches localAddress)', () => {
    const middleware = getHostValidationMiddleware({
      host: 'localhost',
      allowedHosts: [],
      localAddress: 'http://localhost:6006',
      networkAddress: 'http://192.168.1.100:6006',
    });
    const req = createMockRequest({ host: 'localhost:6006' });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('calls next() when Host matches networkAddress', () => {
    const middleware = getHostValidationMiddleware({
      host: '0.0.0.0',
      allowedHosts: [],
      localAddress: 'http://localhost:6006',
      networkAddress: 'http://192.168.1.100:6006',
    });
    const req = createMockRequest({ host: '192.168.1.100:6006' });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('calls next() when allowedHosts is empty but Host matches localAddress', () => {
    const middleware = getHostValidationMiddleware({
      host: 'localhost',
      allowedHosts: [],
      localAddress: 'http://localhost:6006',
      networkAddress: 'http://192.168.1.100:6006',
    });
    const req = createMockRequest({ host: 'localhost:6006' });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('returns 403 when Host header is absent (allowedHosts not true)', () => {
    const middleware = getHostValidationMiddleware({
      host: 'localhost',
      allowedHosts: [],
      localAddress: 'http://localhost:6006',
    });
    const req = createMockRequest({});
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'text/plain' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when Host matches allowedHosts hostname (custom domain)', () => {
    const middleware = getHostValidationMiddleware({
      allowedHosts: ['my-app.example.com'],
    });
    const req = createMockRequest({ host: 'my-app.example.com:6006' });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.writeHead).not.toHaveBeenCalled();
  });
});

describe('isValidHost', () => {
  const options = {
    localAddress: 'http://localhost:6006',
    networkAddress: 'http://192.168.1.100:6006',
  } as any;

  /** When allowedHosts is set to [], only local/network hosts are allowed (no default allow-all). */
  const strictOptions = { ...options, allowedHosts: [] } as any;

  it('returns true for exact local address match', () => {
    expect(isValidHost('localhost:6006', options)).toBe(true);
  });

  it('returns true for network address match', () => {
    expect(isValidHost('192.168.1.100:6006', options)).toBe(true);
  });

  it('returns true for localhost host', () => {
    expect(isValidHost('localhost:6006', options)).toBe(true);
  });

  it('when allowedHosts is undefined (default []), rejects foreign hosts', () => {
    expect(isValidHost('malicious-site.com', options)).toBe(false);
    expect(isValidHost('any-origin.example.com', options)).toBe(false);
  });

  it('when allowedHosts is true, allows any host', () => {
    const allowAllOptions = { ...options, allowedHosts: true } as any;
    expect(isValidHost('malicious-site.com', allowAllOptions)).toBe(true);
    expect(isValidHost('any-origin.example.com', allowAllOptions)).toBe(true);
  });

  it('returns false for different host when allowedHosts is empty', () => {
    expect(isValidHost('malicious-site.com', strictOptions)).toBe(false);
  });

  it('returns true for localhost with different port (host-validation-middleware allows localhost)', () => {
    expect(isValidHost('localhost:8080', strictOptions)).toBe(true);
  });

  it('returns true for localhost with same host (host-validation-middleware allows localhost)', () => {
    expect(isValidHost('localhost:6006', strictOptions)).toBe(true);
  });

  it('returns false for undefined host when not allow-all', () => {
    expect(isValidHost(undefined, strictOptions)).toBe(false);
  });

  it('returns false for null host when not allow-all', () => {
    expect(isValidHost(null as any, strictOptions)).toBe(false);
  });

  it('returns true when localAddress is missing but hostname is localhost (host-validation-middleware allows localhost)', () => {
    const optionsWithoutLocal = {
      networkAddress: 'http://192.168.1.100:6006',
      allowedHosts: [],
    } as any;
    expect(isValidHost('localhost:6006', optionsWithoutLocal)).toBe(true);
  });

  it('handles https local/network addresses correctly', () => {
    const httpsOptions = {
      localAddress: 'https://localhost:6006',
      networkAddress: 'https://192.168.1.100:6006',
    } as any;
    expect(isValidHost('localhost:6006', httpsOptions)).toBe(true);
    expect(isValidHost('192.168.1.100:6006', httpsOptions)).toBe(true);
    const strictHttpsOptions = { ...httpsOptions, allowedHosts: [] } as any;
    expect(isValidHost('localhost:6006', strictHttpsOptions)).toBe(true);
  });

  it('handles a missing network address', () => {
    const optionsWithoutNetwork = {
      localAddress: 'http://localhost:6006',
    } as any;
    expect(isValidHost('localhost:6006', optionsWithoutNetwork)).toBe(true);
    const strictNoNetwork = { ...optionsWithoutNetwork, allowedHosts: [] } as any;
    expect(isValidHost('192.168.1.100:6006', strictNoNetwork)).toBe(false);
  });

  it('rejects an IP address that is not a known address', () => {
    expect(isValidHost('203.0.113.5:6006', strictOptions)).toBe(false);
    expect(isValidHost('[2001:db8::5]:6006', strictOptions)).toBe(false);
    const optionsWithHostname = { ...strictOptions, allowedHosts: ['my-app.example.com'] } as any;
    expect(isValidHost('203.0.113.5:6006', optionsWithHostname)).toBe(false);
  });

  it('allows loopback hostnames', () => {
    expect(isValidHost('127.0.0.1:6006', strictOptions)).toBe(true);
    expect(isValidHost('app.localhost:6006', strictOptions)).toBe(true);
  });

  it('rejects other loopback addresses and 0.0.0.0 unless they are known', () => {
    expect(isValidHost('127.1.2.3:6006', strictOptions)).toBe(false);
    expect(isValidHost('[::1]:6006', strictOptions)).toBe(false);
    expect(isValidHost('0.0.0.0:6006', strictOptions)).toBe(false);
  });

  it('allows an IP address listed in allowedHosts, in any spelling', () => {
    const optionsWithIps = { ...strictOptions, allowedHosts: ['10.0.0.9', '[2001:db8::1]'] } as any;
    expect(isValidHost('10.0.0.9:6006', optionsWithIps)).toBe(true);
    expect(isValidHost('[2001:DB8:0:0:0:0:0:1]:6006', optionsWithIps)).toBe(true);
    expect(isValidHost('10.0.0.10:6006', optionsWithIps)).toBe(false);
  });

  it('allows the IP address passed via --host', () => {
    const optionsWithIpHost = { host: '10.0.0.5', allowedHosts: [] } as any;
    expect(isValidHost('10.0.0.5:6006', optionsWithIpHost)).toBe(true);
    expect(isValidHost('10.0.0.6:6006', optionsWithIpHost)).toBe(false);
  });

  it('allows the addresses of this machine', () => {
    expect(isValidHost('10.1.2.3:6006', strictOptions)).toBe(true);
    expect(isValidHost('[fe80::1]:6006', strictOptions)).toBe(true);
  });

  it('returns true when request host is in allowedHosts', () => {
    const optionsWithAllowed = {
      ...options,
      allowedHosts: ['my-app.example.com', 'other.example.com'],
    } as any;
    expect(isValidHost('my-app.example.com', optionsWithAllowed)).toBe(true);
    expect(isValidHost('other.example.com', optionsWithAllowed)).toBe(true);
  });

  it('returns false when request host is not in allowedHosts and not local/network', () => {
    const optionsWithAllowed = {
      localAddress: 'http://localhost:6006',
      networkAddress: 'http://192.168.1.100:6006',
      allowedHosts: ['my-app.example.com'],
    } as any;
    expect(isValidHost('other-site.com', optionsWithAllowed)).toBe(false);
  });

  it('allowedHosts does not override default local/network checks', () => {
    const optionsWithAllowed = {
      ...options,
      allowedHosts: ['my-app.example.com'],
    } as any;
    expect(isValidHost('localhost:6006', optionsWithAllowed)).toBe(true);
    expect(isValidHost('192.168.1.100:6006', optionsWithAllowed)).toBe(true);
  });

  it('empty allowedHosts does not allow arbitrary hosts', () => {
    const optionsWithEmptyAllowed = {
      localAddress: 'http://localhost:6006',
      allowedHosts: [],
    } as any;
    expect(isValidHost('localhost:6006', optionsWithEmptyAllowed)).toBe(true);
    expect(isValidHost('arbitrary.com', optionsWithEmptyAllowed)).toBe(false);
  });

  it('when host is 0.0.0.0 and allowedHosts is empty, permits all hosts', () => {
    const optionsZeroHost = {
      host: '0.0.0.0',
      allowedHosts: [],
    } as any;
    expect(isValidHost('malicious-site.com', optionsZeroHost)).toBe(true);
    expect(isValidHost('any-origin.example.com', optionsZeroHost)).toBe(true);
  });

  it('when host is 0.0.0.0 but allowedHosts is not empty, does not permit arbitrary hosts', () => {
    const optionsZeroHostWithAllowed = {
      host: '0.0.0.0',
      localAddress: 'http://localhost:6006',
      allowedHosts: ['my-app.example.com'],
    } as any;
    expect(isValidHost('malicious-site.com', optionsZeroHostWithAllowed)).toBe(false);
    expect(isValidHost('my-app.example.com', optionsZeroHostWithAllowed)).toBe(true);
  });

  it('when allowedHosts has hostnames, matches by hostname (host-validation-middleware ignores port in allowedHosts)', () => {
    const optionsWithAllowed = {
      localAddress: 'http://localhost:6006',
      allowedHosts: ['my-app.example.com', 'other.example.com'],
    } as any;
    expect(isValidHost('my-app.example.com:8443', optionsWithAllowed)).toBe(true);
    expect(isValidHost('other.example.com:8080', optionsWithAllowed)).toBe(true);
    expect(isValidHost('other-site.com:8080', optionsWithAllowed)).toBe(false);
  });

  it('allows the hostname passed via --host', () => {
    const optionsWithHostname = {
      host: 'my-host.com',
      localAddress: 'http://localhost:6006/',
      networkAddress: 'http://my-host.com:6006/',
      allowedHosts: [],
    } as any;
    expect(isValidHost('my-host.com:6006', optionsWithHostname)).toBe(true);
    expect(isValidHost('my-host.com', optionsWithHostname)).toBe(true);
    expect(isValidHost('other-host.com:6006', optionsWithHostname)).toBe(false);
  });
});
