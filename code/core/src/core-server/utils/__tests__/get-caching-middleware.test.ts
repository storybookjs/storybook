import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import polka from 'polka';

import {
  getCachingMiddleware,
  getPreviewBuilderCachingMiddleware,
} from '../get-caching-middleware.ts';

let close: (() => void) | undefined;

afterEach(() => {
  close?.();
  close = undefined;
});

// The order in which the dev server registers them: Storybook's routes, the preview builder, and
// the routes registered once the preview has started.
const startDevServer = async () => {
  const app = polka();
  app.use(getCachingMiddleware());
  app.get('/index.json', (req, res) => {
    res.end('{}');
  });

  app.use(getPreviewBuilderCachingMiddleware());
  app.use((req, res, next) => {
    if (req.path === '/src/Button.tsx') {
      // Like Vite: revalidate by ETag, and a bare 304 when the browser's copy is current.
      res.setHeader('ETag', 'W/"1"');
      if (req.headers['if-none-match'] === 'W/"1"') {
        res.statusCode = 304;
        res.end();
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.end('export {}');
      return;
    }
    if (req.path === '/node_modules/pglite/dist/pglite.wasm') {
      // Like Vite's static files: no Cache-Control of its own.
      res.end('wasm');
      return;
    }
    next();
  });
  app.use(getCachingMiddleware());

  app.get('/manifests/components.json', (req, res) => {
    res.end('{}');
  });

  await new Promise<void>((resolve) => app.listen(0, '127.0.0.1', resolve));
  close = () => app.server?.close();
  const { port } = app.server?.address() as AddressInfo;
  return (path: string, headers?: Record<string, string>) =>
    fetch(`http://127.0.0.1:${port}${path}`, { headers });
};

describe('getCachingMiddleware', () => {
  it("lets the browser keep none of Storybook's own responses", async () => {
    const request = await startDevServer();

    expect((await request('/index.json')).headers.get('Cache-Control')).toBe('no-store');
    expect((await request('/manifests/components.json')).headers.get('Cache-Control')).toBe(
      'no-store'
    );
  });

  it("leaves the preview builder's responses to the builder", async () => {
    const request = await startDevServer();

    const module = await request('/src/Button.tsx');
    expect(module.headers.get('Cache-Control')).toBe('no-cache');

    const revalidated = await request('/src/Button.tsx', { 'If-None-Match': 'W/"1"' });
    expect(revalidated.status).toBe(304);
    expect(revalidated.headers.get('Cache-Control')).toBeNull();

    const wasm = await request('/node_modules/pglite/dist/pglite.wasm');
    expect(wasm.headers.get('Cache-Control')).toBeNull();
  });
});
