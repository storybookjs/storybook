// noinspection JSUnusedGlobalSymbols
import { readFile } from 'node:fs/promises';

import { NoStatsForViteDevError } from 'storybook/internal/server-errors';
import type { Options } from 'storybook/internal/types';

import { copy } from '@ndelangen/fs-extra-unified';
import type { RequestHandler } from 'express';
import express from 'express';
import { join, parse } from 'path';
import type { ViteDevServer } from 'vite';

import { build as viteBuild } from './build';
import { transformIframeHtml } from './transform-iframe-html';
import type { ViteBuilder } from './types';
import { createViteServer } from './vite-server';

export { withoutVitePlugins } from './utils/without-vite-plugins';
export { hasVitePlugins } from './utils/has-vite-plugins';

export * from './types';

function iframeMiddleware(options: Options, server: ViteDevServer): RequestHandler {
  return async (req, res, next) => {
    if (!req.url.match(/^\/iframe\.html($|\?)/)) {
      next();
      return;
    }

    // We need to handle `html-proxy` params for style tag HMR https://github.com/storybookjs/builder-vite/issues/266#issuecomment-1055677865
    // e.g. /iframe.html?html-proxy&index=0.css
    if (req.query['html-proxy'] !== undefined) {
      next();
      return;
    }

    const indexHtml = await readFile(
      require.resolve('@storybook/builder-vite/input/iframe.html'),
      'utf-8'
    );
    const generated = await transformIframeHtml(indexHtml, options);
    const transformed = await server.transformIndexHtml('/iframe.html', generated);
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(transformed);
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
  const previewDirOrigin = previewResolvedDir;

  router.use(`/sb-preview`, express.static(previewDirOrigin, { immutable: true, maxAge: '5m' }));

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
  const previewDirOrigin = previewResolvedDir;
  const previewDirTarget = join(options.outputDir || '', `sb-preview`);

  const previewFiles = copy(previewDirOrigin, previewDirTarget, {
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
