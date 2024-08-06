// noinspection JSUnusedGlobalSymbols

import * as fs from 'fs-extra';
import type { NextHandleFunction } from 'connect';
import type { ViteDevServer } from 'vite';
import { join, parse } from 'path';
import { NoStatsForViteDevError } from 'storybook/internal/server-errors';
import type { Options } from 'storybook/internal/types';
import { corePath } from 'storybook/core-path';
import { transformIframeHtml } from './transform-iframe-html';
import { createViteServer } from './vite-server';
import { build as viteBuild } from './build';
import type { ViteBuilder } from './types';
import sirv from 'sirv';

export { withoutVitePlugins } from './utils/without-vite-plugins';
export { hasVitePlugins } from './utils/has-vite-plugins';

export * from './types';

function iframeMiddleware(options: Options, server: ViteDevServer): NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url || !req.url.match(/^\/iframe\.html($|\?)/)) {
      next();
      return;
    }
    const url = new URL(req.url, 'https://storybook.js.org');

    // We need to handle `html-proxy` params for style tag HMR https://github.com/storybookjs/builder-vite/issues/266#issuecomment-1055677865
    // e.g. /iframe.html?html-proxy&index=0.css
    if (url.searchParams.has('html-proxy')) {
      next();
      return;
    }

    const indexHtml = await fs.readFile(
      require.resolve('@storybook/builder-vite/input/iframe.html'),
      'utf-8'
    );
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
  app,
  server: devServer,
}) => {
  server = await createViteServer(options as Options, devServer);

  const previewResolvedDir = join(corePath, 'dist/preview');
  const previewDirOrigin = previewResolvedDir;
  const servePreview = sirv(previewDirOrigin, {
    maxAge: 300000,
    dev: true,
    immutable: true,
  });

  app.use('/sb-preview', (req, res, next) => {
    if (!req.url || req.url === '/') {
      next();
      return;
    }

    servePreview(req, res, next);
  });

  app.use(iframeMiddleware(options as Options, server));
  app.use(server.middlewares);

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

  const previewResolvedDir = join(corePath, 'dist/preview');
  const previewDirOrigin = previewResolvedDir;
  const previewDirTarget = join(options.outputDir || '', `sb-preview`);

  const previewFiles = fs.copy(previewDirOrigin, previewDirTarget, {
    filter: (src) => {
      const { ext } = parse(src);
      if (ext) {
        return ext === '.js';
      }
      return true;
    },
  });

  const [out] = await Promise.all([viteCompilation, previewFiles]);

  return out;
};
