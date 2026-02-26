import { describe, expect, it, vi } from 'vitest';

import { getHostValidationMiddleware } from '../getHostValidationMiddleware';

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
    const req = createMockRequest({ origin: 'http://malicious-site.com' });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it('returns 403 when Host is invalid (strict allowedHosts)', () => {
    const middleware = getHostValidationMiddleware({
      host: 'localhost',
      allowedHosts: ['localhost'],
      localAddress: 'http://localhost:6006',
      networkAddress: 'http://192.168.1.100:6006',
    });
    const req = createMockRequest({ host: 'evil.com:6006' });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'text/plain' });
    expect(res.end).toHaveBeenCalledWith('Invalid origin');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when Host is valid (matches localAddress)', () => {
    const middleware = getHostValidationMiddleware({
      host: 'localhost',
      allowedHosts: ['localhost'],
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
      allowedHosts: ['localhost'],
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
