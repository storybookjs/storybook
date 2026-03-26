// noinspection JSUnusedGlobalSymbols
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { NoStatsForViteDevError } from 'storybook/internal/server-errors';
import type { Builder, Middleware, ModuleGraph, Options } from 'storybook/internal/types';

import type { ViteDevServer } from 'vite';

import { build as viteBuild } from './build';
import type { ViteBuilder } from './types';
import { createViteServer } from './vite-server';
import { buildModuleGraph } from './utils/build-module-graph';

export { withoutVitePlugins } from './utils/without-vite-plugins';
export { hasVitePlugins } from './utils/has-vite-plugins';

export * from './types';

function iframeHandler(options: Options, server: ViteDevServer): Middleware {
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

let server: ViteDevServer;
const listeners = new Set<(moduleGraph: ModuleGraph) => void>();
let debounce: ReturnType<typeof setTimeout> | undefined;
let watcherChangeHandler: (() => void) | undefined;
let waitForModuleGraph: ReturnType<typeof setInterval> | undefined;

function notifyListeners(moduleGraph: ModuleGraph): void {
  listeners.forEach((listener) => {
    listener(moduleGraph);
  });
}

export async function bail(): Promise<void> {
  if (watcherChangeHandler) {
    server?.watcher.off('all', watcherChangeHandler);
    watcherChangeHandler = undefined;
  }

  if (waitForModuleGraph) {
    clearInterval(waitForModuleGraph);
    waitForModuleGraph = undefined;
  }

  if (debounce) {
    clearTimeout(debounce);
    debounce = undefined;
  }

  listeners.clear();
  return server?.close();
}

export const onModuleGraphChange: NonNullable<Builder<Options>['onModuleGraphChange']> = (cb) => {
  listeners.add(cb);

  return () => {
    listeners.delete(cb);
  };
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

  // Debounce handler to prevent multiple callback invocations when multiple files are edited
  watcherChangeHandler = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      notifyListeners(buildModuleGraph(server.moduleGraph.fileToModulesMap));
    }, 100);
  };

  server.watcher.on('all', watcherChangeHandler);

  waitForModuleGraph = setInterval(async () => {
    if (server.moduleGraph.fileToModulesMap.size > 0) {
      clearInterval(waitForModuleGraph);
      waitForModuleGraph = undefined;
      await server.waitForRequestsIdle();
      watcherChangeHandler?.();
    }
  }, 1000);

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
