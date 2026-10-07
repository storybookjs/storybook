import { type IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { createEmbedAccess } from '../embed-access.ts';

const embed = createEmbedAccess('http://localhost:6006/');
const embedHost = new URL(embed.origin!).host;

// Sends a response through the middleware and returns the headers it ends up with.
function respond({
  host = embedHost,
  method = 'GET',
  send = (res: ServerResponse) => res.writeHead(200, { 'Content-Type': 'text/javascript' }),
} = {}) {
  const req = { headers: { host }, method, url: '/src/Button.tsx' } as IncomingMessage;
  const res = new ServerResponse(req);
  const next = vi.fn();
  embed.middleware(req, res, next);
  expect(next).toHaveBeenCalledTimes(1);
  send(res);
  return res.getHeaders();
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

  it.each(['GET', 'HEAD'])('lets any page read a file it %ss from the embed origin', (method) => {
    expect(respond({ method })).toMatchObject({
      'access-control-allow-origin': '*',
      'referrer-policy': 'no-referrer',
    });
  });

  it.each([
    'localhost:6006',
    'sb-other.localhost:6006',
    embedHost.replace(':6006', ''),
    `${embedHost}.evil.com`,
  ])('changes nothing for a request to %s', (host) => {
    const headers = respond({ host });

    expect(headers).not.toHaveProperty('access-control-allow-origin');
    expect(headers).not.toHaveProperty('referrer-policy');
  });

  it('keeps a cached file readable when the server confirms it with a 304', () => {
    expect(respond({ send: (res) => res.writeHead(304) })).toHaveProperty(
      'access-control-allow-origin',
      '*'
    );
  });

  it.each(['OPTIONS', 'POST'])('does not let a page read a %s response', (method) => {
    expect(respond({ method })).not.toHaveProperty('access-control-allow-origin');
  });

  it.each([
    [
      'passed to writeHead',
      (res: ServerResponse) => res.writeHead(200, { 'content-type': 'text/html' }),
    ],
    [
      'set before the body',
      (res: ServerResponse) => res.setHeader('Content-Type', 'text/html; charset=utf-8').end(),
    ],
    ['left out', (res: ServerResponse) => res.end()],
  ])('serves a page without letting other pages read it, with its type %s', (_, send) => {
    const headers = respond({ send });

    expect(headers).not.toHaveProperty('access-control-allow-origin');
    expect(headers).toHaveProperty('referrer-policy', 'no-referrer');
  });
});
