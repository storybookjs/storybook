// noinspection JSUnusedGlobalSymbols
import { cp, readFile } from 'node:fs/promises';
import { join, parse } from 'node:path';

import { NoStatsForViteDevError } from 'storybook/internal/server-errors';
import type { Middleware, Options } from 'storybook/internal/types';

import sirv from 'sirv';
import type { ViteDevServer } from 'vite';

import { build as viteBuild } from './build';
import { transformIframeHtml } from './transform-iframe-html';
import type { ViteBuilder } from './types';
import { createViteServer } from './vite-server';

export { withoutVitePlugins } from './utils/without-vite-plugins';
export { hasVitePlugins } from './utils/has-vite-plugins';

export * from './types';

function iframeMiddleware(options: Options, server: ViteDevServer): Middleware {
  return async (req, res, next) => {
    if (!req.url || !req.url.match(/^\/iframe\.html($|\?)/)) {
      next();
      return;
    }
    // the base isn't used for anything, but it's required by the URL constructor
    const url = new URL(req.url, 'http://localhost:6006');

    // We need to handle `html-proxy` params for style tag HMR https://github.com/storybookjs/builder-vite/issues/266#issuecomment-1055677865
    // e.g. /iframe.html?html-proxy&index=0.css
    if (url.searchParams.has('html-proxy')) {
      next();
      return;
    }

    const indexHtml = await readFile(require.resolve('@storybook/builder-vite/input/iframe.html'), {
      encoding: 'utf8',
    });
    const generated = await transformIframeHtml(indexHtml, options);
    const transformed = await server.transformIndexHtml('/iframe.html', generated);
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.write(transformed);
    res.end();
  };
}

let server: ViteDevServer;

export async function bail(): Promise<void> {
  return server?.close();
}

export const start: ViteBuilder['start'] = async ({
  startTime,
  options,
  router,
  server: devServer,
}) => {
  server = await createViteServer(options as Options, devServer);

  const previewResolvedDir = join((await import('storybook/core-path')).corePath, 'dist/preview');
  router.use(
    '/sb-preview',
    sirv(previewResolvedDir, {
      maxAge: 300000,
      dev: true,
      immutable: true,
    })
  );
  router.use(iframeMiddleware(options as Options, server));
  router.use(server.middlewares);

  return {
    bail,
    stats: {
      toJson: () => {
        throw new NoStatsForViteDevError();
      },
    },
    totalTime: process.hrtime(startTime),
  };
};

export const build: ViteBuilder['build'] = async ({ options }) => {
  const viteCompilation = viteBuild(options as Options);

  const previewResolvedDir = join((await import('storybook/core-path')).corePath, 'dist/preview');
  const previewDirTarget = join(options.outputDir || '', `sb-preview`);
  const previewFiles = cp(previewResolvedDir, previewDirTarget, {
    filter: (src) => {
      const { ext } = parse(src);
      if (ext) {
        return ext === '.js';
      }
      return true;
    },
    recursive: true,
  });

  const [out] = await Promise.all([viteCompilation, previewFiles]);

  return out;
};
