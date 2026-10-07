import type { IncomingMessage } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { createEmbedAccess } from '../embed-access.ts';

const embed = createEmbedAccess('http://localhost:6006/');
const embedHost = new URL(embed.origin!).host;

function request({ host = embedHost, method = 'GET', url = '/src/Button.tsx?t=1' } = {}) {
  const res = { setHeader: vi.fn() };
  const next = vi.fn();
  embed.middleware({ headers: { host }, method, url } as IncomingMessage, res as any, next);
  expect(next).toHaveBeenCalledTimes(1);
  return res.setHeader;
}

describe('createEmbedAccess', () => {
  it('serves embeds from an unguessable localhost subdomain that differs per server', () => {
    expect(embed.origin).toMatch(/^http:\/\/sb-[0-9a-f-]{36}\.localhost:6006$/);
    expect(createEmbedAccess('http://localhost:6006/').origin).not.toBe(embed.origin);
  });

  it('keeps the protocol of the local address', () => {
    expect(createEmbedAccess('https://localhost:6006/').origin).toMatch(/^https:\/\/sb-/);
  });

  it.each([undefined, 'localhost', '0.0.0.0'])(
    'has an origin when the server listens on %s',
    (host) => {
      expect(createEmbedAccess('http://localhost:6006/', host).origin).toBeDefined();
    }
  );

  it('has no origin when the server only listens on a network address', () => {
    expect(createEmbedAccess('http://localhost:6006/', '192.168.1.5').origin).toBeUndefined();
  });

  it('lets any page read a file requested from the embed origin', () => {
    const setHeader = request();

    expect(setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
  });

  it.each([
    'localhost:6006',
    'sb-other.localhost:6006',
    embedHost.replace(':6006', ''),
    `${embedHost}.evil.com`,
  ])('changes nothing for a request to %s', (host) => {
    expect(request({ host })).not.toHaveBeenCalled();
  });

  it.each(['OPTIONS', 'POST', 'PUT', 'DELETE'])(
    'does not let a page read a %s response',
    (method) => {
      expect(request({ method })).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    }
  );

  it.each(['/iframe.html?id=button--primary', '/', '/index.html', '/docs/'])(
    'does not let a page read %s, which holds the channel token',
    (url) => {
      expect(request({ url })).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    }
  );
});
