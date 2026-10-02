import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { Middleware } from 'storybook/internal/types';

import type { ViteDevServer } from 'vite';

export function iframeHandler(server: ViteDevServer): Middleware {
  return async (req, res) => {
    const indexHtml = await readFile(
      fileURLToPath(import.meta.resolve('@storybook/builder-vite/input/iframe.html')),
      {
        encoding: 'utf8',
      }
    );
    const transformed = await server.transformIndexHtml('/iframe.html', indexHtml);
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.write(transformed);
    res.end();
  };
}

export function iframeRoute(server: ViteDevServer): Middleware {
  const handler = iframeHandler(server);

  return async (req, res, next) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    if (pathname !== '/iframe.html' || (req.method !== 'GET' && req.method !== 'HEAD')) {
      return next();
    }

    return handler(req, res, next);
  };
}
