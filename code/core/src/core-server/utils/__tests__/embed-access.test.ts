import { EventEmitter } from 'node:events';
import type { Server } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { type EmbedRequest, attachEmbedAccess, getEmbedBase } from '../embed-access.ts';

function request(url: string, method = 'GET') {
  const server = new EventEmitter() as Server;
  attachEmbedAccess(server, 'secret');
  const req = { url, method } as EmbedRequest;
  const res = { setHeader: vi.fn() };
  server.emit('request', req, res);
  return { req, res };
}

describe('getEmbedBase', () => {
  it('returns the same unguessable path on every call', () => {
    expect(getEmbedBase()).toMatch(/^\/embed\/[0-9a-f-]{36}\/$/);
    expect(getEmbedBase()).toBe(getEmbedBase());
  });
});

describe('attachEmbedAccess', () => {
  it('strips the base and lets opaque origins read the response', () => {
    const { req, res } = request('/embed/secret/iframe.html?id=button--primary');

    expect(req.url).toBe('/iframe.html?id=button--primary');
    expect(req.storybookEmbedBase).toBe('/embed/secret/');
    expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'no-referrer');
  });

  it.each([
    '/iframe.html?id=button--primary',
    '/embed/wrong/iframe.html',
    '/embed/secret',
    '/embed//iframe.html',
    '/other/embed/secret/iframe.html',
  ])('leaves %s untouched', (url) => {
    const { req, res } = request(url);

    expect(req.url).toBe(url);
    expect(req.storybookEmbedBase).toBeUndefined();
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it.each(['OPTIONS', 'POST', 'PUT', 'DELETE'])('leaves a %s request untouched', (method) => {
    const { req, res } = request('/embed/secret/mcp', method);

    expect(req.url).toBe('/embed/secret/mcp');
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('runs before the listeners already on the server', () => {
    const server = new EventEmitter() as Server;
    const seen: (string | undefined)[] = [];
    server.on('request', (req) => seen.push(req.url));
    attachEmbedAccess(server, 'secret');

    server.emit(
      'request',
      { url: '/embed/secret/index.json', method: 'GET' },
      { setHeader: vi.fn() }
    );

    expect(seen).toEqual(['/index.json']);
  });
});
