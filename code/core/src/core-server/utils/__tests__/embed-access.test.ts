import type { IncomingMessage } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { createEmbedHostname, getEmbedAccessMiddleware } from '../embed-access.ts';

function request(host: string | undefined, method = 'GET', url = '/src/Button.tsx?t=1') {
  const res = { setHeader: vi.fn() };
  const next = vi.fn();
  getEmbedAccessMiddleware('sb-secret.localhost')(
    { headers: { host }, method, url } as IncomingMessage,
    res as any,
    next
  );
  expect(next).toHaveBeenCalledTimes(1);
  return res;
}

describe('createEmbedHostname', () => {
  it('returns an unguessable localhost subdomain that differs per call', () => {
    const hostname = createEmbedHostname();

    expect(hostname).toMatch(/^sb-[0-9a-f-]{36}\.localhost$/);
    expect(createEmbedHostname()).not.toBe(hostname);
  });
});

describe('getEmbedAccessMiddleware', () => {
  it.each(['sb-secret.localhost', 'sb-secret.localhost:6006'])(
    'lets opaque origins read responses requested from %s',
    (host) => {
      const res = request(host);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    }
  );

  it.each([undefined, 'localhost:6006', 'sb-other.localhost:6006', 'sb-secret.localhost.evil.com'])(
    'adds no cross-origin access for host %s',
    (host) => {
      expect(request(host).setHeader).not.toHaveBeenCalled();
    }
  );

  it.each(['OPTIONS', 'POST', 'PUT', 'DELETE'])(
    'adds no cross-origin access to a %s request',
    (method) => {
      expect(request('sb-secret.localhost:6006', method).setHeader).not.toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        '*'
      );
    }
  );

  it.each(['/iframe.html?id=button--primary', '/', '/index.html', '/docs/'])(
    'keeps the document at %s, which carries the channel token, unreadable',
    (url) => {
      const res = request('sb-secret.localhost:6006', 'GET', url);

      expect(res.setHeader).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
    }
  );
});
