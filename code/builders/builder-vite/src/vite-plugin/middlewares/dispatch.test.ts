import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import type { Options } from 'storybook/internal/types';

import type { Connect, ViteDevServer } from 'vite';
import { describe, expect, it, vi } from 'vitest';

import { registerStorybookMiddleware } from './dispatch.ts';

vi.mock('./iframe.ts', () => ({
  renderIframeHtml: vi.fn(async () => '<html>iframe</html>'),
}));
vi.mock('./manager.ts', () => ({
  createManagerAssetsHandler: (): Connect.NextHandleFunction => (_req, _res, next) => next(),
}));

const MANAGER_HTML = '<html>manager</html>';

function createMiddleware(basePath: string) {
  let middleware: Connect.NextHandleFunction;
  const server = {
    middlewares: {
      use(handler: Connect.NextHandleFunction) {
        middleware = handler;
      },
    },
    environments: {},
    config: { root: '/project' },
  } as unknown as ViteDevServer;

  registerStorybookMiddleware(server, {
    options: {} as Options,
    basePath,
    managerHtml: MANAGER_HTML,
    storyIndexGenerator: {
      getIndex: async () => ({ v: 5, entries: {} }),
    } as unknown as StoryIndexGenerator,
    staticHandlers: [],
    proxy: vi.fn(),
  });

  return middleware!;
}

function createRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      res.headers[name.toLowerCase()] = value;
    },
    end(body?: unknown) {
      res.body = body;
    },
    once() {},
    off() {},
  };
  return res;
}

async function run(middleware: Connect.NextHandleFunction, url: string) {
  const req = { url } as Connect.IncomingMessage;
  const res = createRes();
  const next = vi.fn();
  await middleware(req, res as never, next);
  return { req, res, next };
}

describe('storybook dispatch middleware', () => {
  it('redirects the bare base path to the trailing-slash form', async () => {
    const middleware = createMiddleware('/__storybook/');
    const { res, next } = await run(middleware, '/__storybook');

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/__storybook/');
  });

  it('preserves the query string when redirecting', async () => {
    const middleware = createMiddleware('/__storybook/');
    const { res } = await run(middleware, '/__storybook?path=/story/button--primary');

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/__storybook/?path=/story/button--primary');
  });

  it('serves the manager HTML at the base path with trailing slash', async () => {
    const middleware = createMiddleware('/__storybook/');
    const { res, next } = await run(middleware, '/__storybook/');

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(MANAGER_HTML);
  });

  it('serves the story index at index.json under the base path', async () => {
    const middleware = createMiddleware('/__storybook/');
    const { res } = await run(middleware, '/__storybook/index.json');

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual({ v: 5, entries: {} });
  });

  it('ignores URLs outside the base path', async () => {
    const middleware = createMiddleware('/__storybook/');
    const { res, next } = await run(middleware, '/app/page');

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });

  it('ignores URLs where the base is only a partial path segment match', async () => {
    const middleware = createMiddleware('/__storybook/');
    const { next } = await run(middleware, '/__storybook-docs/page');

    expect(next).toHaveBeenCalled();
  });

  it('serves the manager HTML at the root without redirecting when mounted at /', async () => {
    const middleware = createMiddleware('/');
    const { res, next } = await run(middleware, '/');

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(MANAGER_HTML);
  });
});
