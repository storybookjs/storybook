// noinspection JSUnusedGlobalSymbols
import { NoStatsForViteDevError } from 'storybook/internal/server-errors';
import type { Builder, Options } from 'storybook/internal/types';

import type { ViteDevServer } from 'vite';

import { build as viteBuild } from './build.ts';
import { createHeadlessViteChangeDetectionAdapter } from './change-detection-adapter/headless.ts';
import { createViteChangeDetectionAdapter } from './change-detection-adapter/index.ts';
import { iframeRoute } from './iframe-handler.ts';
import type { ViteBuilder } from './types.ts';
import { createViteServer } from './vite-server.ts';

export { withoutVitePlugins } from './utils/without-vite-plugins.ts';
export { hasVitePlugins } from './utils/has-vite-plugins.ts';
export { iframeHandler } from './iframe-handler.ts';
export { createViteServer } from './vite-server.ts';

export * from './types.ts';

let server: ViteDevServer;

export async function bail(): Promise<void> {
  return server?.close();
}

/**
 * Returns a {@link ChangeDetectionAdapter} bound to the Vite dev server created by `start()`, or —
 * when `options` are passed by a consumer that runs without a dev server (the `storybook tools`
 * CLI) — a headless adapter that resolves the same config server-lessly.
 *
 * Throws if called without options before `start()` has resolved (i.e. before the Vite dev server
 * exists).
 */
export const changeDetectionAdapter: NonNullable<Builder<Options>['changeDetectionAdapter']> = (
  options
) => {
  if (server) {
    return createViteChangeDetectionAdapter(server);
  }
  if (options) {
    return createHeadlessViteChangeDetectionAdapter(options);
  }
  throw new Error(
    'builder-vite: changeDetectionAdapter() called before start(); the Vite dev server is not ready yet.'
  );
};

export const start: ViteBuilder['start'] = async ({
  startTime,
  options,
  router,
  server: devServer,
}) => {
  const viteServer = await createViteServer(options as Options, devServer);
  server = viteServer;

  router.use(iframeRoute(viteServer));
  router.use(viteServer.middlewares);

  return {
    // Bound to this start call's server; Vite may replace the module-level server before closing the old host.
    bail: () => viteServer.close(),
    stats: {
      toJson: () => {
        throw new NoStatsForViteDevError();
      },
    },
    totalTime: process.hrtime(startTime),
    server: viteServer,
  };
};

export const build: ViteBuilder['build'] = async ({ options }) => {
  return viteBuild(options as Options);
};

export const corePresets = [import.meta.resolve('./preset.js')];
