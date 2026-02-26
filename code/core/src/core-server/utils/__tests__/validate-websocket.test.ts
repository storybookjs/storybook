import { describe, expect, it } from 'vitest';

import { isValidOrigin, isValidToken } from '../validate-websocket';

describe('isValidOrigin', () => {
  const options = {
    localAddress: 'http://localhost:6006',
    networkAddress: 'http://192.168.1.100:6006',
  } as any;

  /** When allowedHosts is set to [], only local/network origins are allowed (no default allow-all). */
  const strictOptions = { ...options, allowedHosts: [] } as any;

  it('returns true for exact local address match', () => {
    expect(isValidOrigin('http://localhost:6006', options)).toBe(true);
  });

  it('returns true for network address match', () => {
    expect(isValidOrigin('http://192.168.1.100:6006', options)).toBe(true);
  });

  it('returns true for localhost origin', () => {
    expect(isValidOrigin('http://localhost:6006', options)).toBe(true);
  });

  it('returns true for 127.0.0.1 origin', () => {
    expect(isValidOrigin('http://127.0.0.1:6006', options)).toBe(true);
  });

  // TODO: Change default to [] in SB11
  it('when allowedHosts is undefined (default true), allows any origin', () => {
    expect(isValidOrigin('http://malicious-site.com', options)).toBe(true);
    expect(isValidOrigin('https://any-origin.example.com', options)).toBe(true);
  });

  it('when allowedHosts is true, allows any origin', () => {
    const allowAllOptions = { ...options, allowedHosts: true } as any;
    expect(isValidOrigin('http://malicious-site.com', allowAllOptions)).toBe(true);
    expect(isValidOrigin('https://any-origin.example.com', allowAllOptions)).toBe(true);
  });

  it('returns false for different origin when allowedHosts is empty', () => {
    expect(isValidOrigin('http://malicious-site.com', strictOptions)).toBe(false);
  });

  it('returns true for localhost with different port (host-validation-middleware allows localhost)', () => {
    expect(isValidOrigin('http://localhost:8080', strictOptions)).toBe(true);
  });

  it('returns true for localhost with different protocol (host-validation-middleware allows localhost)', () => {
    expect(isValidOrigin('https://localhost:6006', strictOptions)).toBe(true);
  });

  it('returns false for undefined origin when not allow-all', () => {
    expect(isValidOrigin(undefined, strictOptions)).toBe(false);
  });

  it('returns false for null origin when not allow-all', () => {
    expect(isValidOrigin(null as any, strictOptions)).toBe(false);
  });

  it('returns true when localAddress is missing but hostname is localhost (host-validation-middleware allows localhost)', () => {
    const optionsWithoutLocal = {
      networkAddress: 'http://192.168.1.100:6006',
      allowedHosts: [],
    } as any;
    expect(isValidOrigin('http://localhost:6006', optionsWithoutLocal)).toBe(true);
  });

  it('handles https protocol correctly', () => {
    const httpsOptions = {
      localAddress: 'https://localhost:6006',
      networkAddress: 'https://192.168.1.100:6006',
    } as any;
    expect(isValidOrigin('https://localhost:6006', httpsOptions)).toBe(true);
    expect(isValidOrigin('https://192.168.1.100:6006', httpsOptions)).toBe(true);
    const strictHttpsOptions = { ...httpsOptions, allowedHosts: [] } as any;
    expect(isValidOrigin('http://localhost:6006', strictHttpsOptions)).toBe(true);
  });

  it('handles network address without port', () => {
    const optionsWithoutNetwork = {
      localAddress: 'http://localhost:6006',
    } as any;
    expect(isValidOrigin('http://localhost:6006', optionsWithoutNetwork)).toBe(true);
    const strictNoNetwork = { ...optionsWithoutNetwork, allowedHosts: [] } as any;
    expect(isValidOrigin('http://192.168.1.100:6006', strictNoNetwork)).toBe(true);
  });

  it('returns true for different network IP (host-validation-middleware allows any IPv4)', () => {
    expect(isValidOrigin('http://10.0.0.1:6006', strictOptions)).toBe(true);
  });

  it('handles origin with path', () => {
    // Origin header should not include path, but if it does, we should still validate correctly
    expect(isValidOrigin('http://localhost:6006/path', options)).toBe(true);
  });

  it('handles origin with query parameters', () => {
    // Origin header should not include query, but if it does, we should still validate correctly
    expect(isValidOrigin('http://localhost:6006?query=value', options)).toBe(true);
  });

  it('returns true when request hostname is in allowedHosts', () => {
    const optionsWithAllowed = {
      ...options,
      allowedHosts: ['my-app.example.com', 'other.example.com'],
    } as any;
    expect(isValidOrigin('https://my-app.example.com', optionsWithAllowed)).toBe(true);
    expect(isValidOrigin('https://other.example.com', optionsWithAllowed)).toBe(true);
  });

  it('returns false when request hostname is not in allowedHosts and not local/network', () => {
    const optionsWithAllowed = {
      localAddress: 'http://localhost:6006',
      networkAddress: 'http://192.168.1.100:6006',
      allowedHosts: ['my-app.example.com'],
    } as any;
    expect(isValidOrigin('https://other-site.com', optionsWithAllowed)).toBe(false);
  });

  it('allowedHosts does not override default local/network checks', () => {
    const optionsWithAllowed = {
      ...options,
      allowedHosts: ['my-app.example.com'],
    } as any;
    expect(isValidOrigin('http://localhost:6006', optionsWithAllowed)).toBe(true);
    expect(isValidOrigin('http://192.168.1.100:6006', optionsWithAllowed)).toBe(true);
  });

  it('empty allowedHosts does not allow arbitrary origins', () => {
    const optionsWithEmptyAllowed = {
      localAddress: 'http://localhost:6006',
      allowedHosts: [],
    } as any;
    expect(isValidOrigin('http://localhost:6006', optionsWithEmptyAllowed)).toBe(true);
    expect(isValidOrigin('https://arbitrary.com', optionsWithEmptyAllowed)).toBe(false);
  });

  it('when host is 0.0.0.0 and allowedHosts is empty, permits all origins', () => {
    const optionsZeroHost = {
      host: '0.0.0.0',
      allowedHosts: [],
    } as any;
    expect(isValidOrigin('http://malicious-site.com', optionsZeroHost)).toBe(true);
    expect(isValidOrigin('https://any-origin.example.com', optionsZeroHost)).toBe(true);
  });

  it('when host is 0.0.0.0 but allowedHosts is not empty, does not permit arbitrary origins', () => {
    const optionsZeroHostWithAllowed = {
      host: '0.0.0.0',
      localAddress: 'http://localhost:6006',
      allowedHosts: ['my-app.example.com'],
    } as any;
    expect(isValidOrigin('http://malicious-site.com', optionsZeroHostWithAllowed)).toBe(false);
    expect(isValidOrigin('https://my-app.example.com', optionsZeroHostWithAllowed)).toBe(true);
  });

  it('when allowedHosts has hostnames, matches by hostname (host-validation-middleware ignores port in allowedHosts)', () => {
    const optionsWithAllowed = {
      localAddress: 'http://localhost:6006',
      allowedHosts: ['my-app.example.com', 'other.example.com'],
    } as any;
    expect(isValidOrigin('https://my-app.example.com:8443', optionsWithAllowed)).toBe(true);
    expect(isValidOrigin('http://other.example.com:8080', optionsWithAllowed)).toBe(true);
    expect(isValidOrigin('https://other-site.com:8080', optionsWithAllowed)).toBe(false);
  });
});

describe('isValidToken', () => {
  const validToken = 'test-token-123';

  it('returns true for matching tokens', () => {
    expect(isValidToken(validToken, validToken)).toBe(true);
  });

  it('returns false for non-matching tokens', () => {
    expect(isValidToken('wrong-token', validToken)).toBe(false);
  });

  it('returns false for null token', () => {
    expect(isValidToken(null, validToken)).toBe(false);
  });

  it('returns false for undefined token', () => {
    expect(isValidToken(undefined as any, validToken)).toBe(false);
  });

  it('returns false for empty token', () => {
    expect(isValidToken('', validToken)).toBe(false);
  });

  it('returns false when expected token is null', () => {
    expect(isValidToken(validToken, null as any)).toBe(false);
  });

  it('returns false when expected token is undefined', () => {
    expect(isValidToken(validToken, undefined as any)).toBe(false);
  });

  it('returns false for empty expected token', () => {
    expect(isValidToken(validToken, '')).toBe(false);
  });

  it('returns false for tokens with different lengths', () => {
    expect(isValidToken('short', 'much-longer-token')).toBe(false);
  });

  it('handles special characters in tokens', () => {
    const specialToken = 'token-with-special-chars-!@#$%^&*()';
    expect(isValidToken(specialToken, specialToken)).toBe(true);
    expect(isValidToken(specialToken, 'different-token')).toBe(false);
  });

  it('handles unicode characters in tokens', () => {
    const unicodeToken = 'token-with-unicode-🚀-测试';
    expect(isValidToken(unicodeToken, unicodeToken)).toBe(true);
    expect(isValidToken(unicodeToken, 'different-token')).toBe(false);
  });
});
