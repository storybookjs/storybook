// noinspection JSUnusedGlobalSymbols
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { NoStatsForViteDevError } from 'storybook/internal/server-errors';
import type { Builder, Middleware, Options } from 'storybook/internal/types';

import type { ViteDevServer } from 'vite';

import { build as viteBuild } from './build.ts';
import { createViteChangeDetectionAdapter } from './change-detection-adapter/index.ts';
import type { ViteBuilder } from './types.ts';
import { createViteServer } from './vite-server.ts';

export { withoutVitePlugins } from './utils/without-vite-plugins.ts';
export { hasVitePlugins } from './utils/has-vite-plugins.ts';

export * from './types.ts';

function iframeHandler(options: Options, server: ViteDevServer): Middleware {
  return async (req, res) => {
    const indexHtml = await readFile(
      fileURLToPath(import.meta.resolve('@storybook/builder-vite/input/iframe.html')),
      {
        encoding: 'utf8',
      }
    );
    // Pass the original request URL (including query string) via Vite's
    // `originalUrl` parameter so plugins' `transformIndexHtml` hooks can
    // detect routing markers like `?env=before` used by the before-after
    // addon. The first argument stays as the canonical `/iframe.html`
    // path because Vite's internal devHtmlHook uses it for `virtual:` /
    // bare-spec module resolution and bails on paths with query strings.
    const originalUrl =
      (req as { originalUrl?: string; url?: string }).originalUrl ??
      (req as { url?: string }).url ??
      '/iframe.html';
    const transformed = await server.transformIndexHtml('/iframe.html', indexHtml, originalUrl);
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

/**
 * Returns a {@link ChangeDetectionAdapter} bound to the Vite dev server created by `start()`.
 *
 * Throws if called before `start()` has resolved (i.e. before the Vite dev server exists).
 */
export const changeDetectionAdapter: NonNullable<
  Builder<Options>['changeDetectionAdapter']
> = () => {
  if (!server) {
    throw new Error(
      'builder-vite: changeDetectionAdapter() called before start(); the Vite dev server is not ready yet.'
    );
  }
  return createViteChangeDetectionAdapter(server);
};

export const start: ViteBuilder['start'] = async ({
  startTime,
  options,
  router,
  server: devServer,
}) => {
  server = await createViteServer(options as Options, devServer);

  router.get('/iframe.html', iframeHandler(options as Options, server));
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
  return viteBuild(options as Options);
};

export const corePresets = [import.meta.resolve('./preset.js')];
