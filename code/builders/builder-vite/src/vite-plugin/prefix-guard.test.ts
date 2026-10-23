import type { IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { createPrefixGuard } from './prefix-guard.ts';

type TestResponse = ServerResponse & {
  body?: unknown;
  headers: Record<string, string | number | readonly string[]>;
  ended: Promise<void>;
};

function createReq(url: string): IncomingMessage {
  return { method: 'GET', url } as IncomingMessage;
}

function createRes(): TestResponse {
  let resolveEnded!: () => void;
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    finished: false,
    headers: {} as Record<string, string | number | readonly string[]>,
    ended: new Promise<void>((resolve) => {
      resolveEnded = resolve;
    }),
    setHeader(name: string, value: string | number | readonly string[]) {
      res.headers[name.toLowerCase()] = value;
      return res as unknown as ServerResponse;
    },
    getHeader(name: string) {
      return res.headers[name.toLowerCase()];
    },
    end(body?: unknown) {
      res.body = body;
      res.finished = true;
      resolveEnded();
      return res as unknown as ServerResponse;
    },
  };

  return res as unknown as TestResponse;
}

describe('createPrefixGuard', () => {
  it.each<{
    name: string;
    basePath: string;
    url: string;
    expected: 'next' | { status: 302; location: string } | { forwardedUrl: string };
  }>([
    {
      name: 'passes non-prefixed URLs to the host',
      basePath: '/__storybook/',
      url: '/app/page',
      expected: 'next',
    },
    {
      name: 'redirects the bare prefixed path',
      basePath: '/__storybook/',
      url: '/__storybook',
      expected: { status: 302, location: '/__storybook/' },
    },
    {
      name: 'redirects the bare prefixed path with a query string',
      basePath: '/__storybook/',
      url: '/__storybook?path=x',
      expected: { status: 302, location: '/__storybook/?path=x' },
    },
    {
      name: 'strips the prefix before forwarding',
      basePath: '/__storybook/',
      url: '/__storybook/index.json',
      expected: { forwardedUrl: '/index.json' },
    },
    {
      name: 'forwards every root request unchanged',
      basePath: '/',
      url: '/index.json',
      expected: { forwardedUrl: '/index.json' },
    },
  ])('$name', async ({ basePath, url, expected }) => {
    const req = createReq(url);
    const res = createRes();
    const next = vi.fn();
    const handler = vi.fn((_req: IncomingMessage, response: ServerResponse) => {
      response.end();
    });
    const guard = createPrefixGuard(basePath, handler);

    guard(req, res, next);

    if (expected === 'next') {
      expect(next).toHaveBeenCalledTimes(1);
      expect(handler).not.toHaveBeenCalled();
      return;
    }

    await res.ended;

    if ('status' in expected) {
      expect(next).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(expected.status);
      expect(res.headers.location).toBe(expected.location);
      return;
    }

    expect(next).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(req.url).toBe(expected.forwardedUrl);
  });
});
