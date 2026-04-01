// noinspection JSUnusedGlobalSymbols
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { logger } from 'storybook/internal/node-logger';
import {
  NoStatsForViteDevError,
  ViteModuleGraphSubscriptionError,
} from 'storybook/internal/server-errors';
import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import type {
  Builder,
  Middleware,
  ModuleGraph,
  ModuleGraphChangeEvent,
  Options,
} from 'storybook/internal/types';

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
const listeners = new Set<(event: ModuleGraphChangeEvent) => void>();
let debounce: ReturnType<typeof setTimeout> | undefined;
let watcherChangeHandler: (() => void) | undefined;
let waitForModuleGraph: ReturnType<typeof setInterval> | undefined;
let moduleGraphRegistrationClosed = false;

function clearModuleGraphPolling(): void {
  if (waitForModuleGraph) {
    clearInterval(waitForModuleGraph);
    waitForModuleGraph = undefined;
  }
}

function notifyListeners(moduleGraph: ModuleGraph): void {
  listeners.forEach((listener) => {
    listener({ type: 'moduleGraph', moduleGraph });
  });
}

function notifyListenersOfStartupFailure(
  event: Extract<ModuleGraphChangeEvent, { type: 'unavailable' | 'error' }>
): void {
  listeners.forEach((listener) => {
    listener(event);
  });
}

export async function bail(): Promise<void> {
  if (watcherChangeHandler) {
    server?.watcher.off('all', watcherChangeHandler);
    watcherChangeHandler = undefined;
  }

  clearModuleGraphPolling();

  if (debounce) {
    clearTimeout(debounce);
    debounce = undefined;
  }

  moduleGraphRegistrationClosed = false;
  listeners.clear();
  return server?.close();
}

export const onModuleGraphChange: NonNullable<Builder<Options>['onModuleGraphChange']> = (cb) => {
  if (moduleGraphRegistrationClosed) {
    throw new ViteModuleGraphSubscriptionError();
  }

  listeners.add(cb);

  return () => {
    listeners.delete(cb);
  };
};

const startChangeDetection = async (options: Options) => {
  const startTime = process.hrtime();
  const indexGenerator = await options.presets.apply<StoryIndexGenerator>('storyIndexGenerator');
  const storyIndex = await indexGenerator.getIndex();
  const importPaths = new Set(Object.values(storyIndex.entries).map((entry) => entry.importPath));

  // Warm up the module graph for all story files
  await Promise.all(Array.from(importPaths, (importPath) => server.warmupRequest(importPath)));

  // Wait for the module graph to be ready by polling for it to be non-empty
  waitForModuleGraph = setInterval(() => {
    void (async () => {
      try {
        if (!watcherChangeHandler) {
          clearModuleGraphPolling();
          return;
        }

        if (process.hrtime(startTime)[0] > 30) {
          clearModuleGraphPolling();
          const error = new Error(
            'Timed out while waiting for the Vite module graph to initialize'
          );
          logger.error('Failed to complete Vite change detection startup');
          logger.error(error);
          notifyListenersOfStartupFailure({
            type: 'unavailable',
            reason: error.message,
            error,
          });
          return;
        }

        if (server.moduleGraph.fileToModulesMap.size > 0) {
          clearModuleGraphPolling();
          await server.waitForRequestsIdle();
          if (!watcherChangeHandler) {
            return;
          }

          server.watcher.on('all', watcherChangeHandler);
          watcherChangeHandler();
        }
      } catch (error) {
        clearModuleGraphPolling();
        logger.error('Failed to complete Vite change detection startup');
        logger.error(error instanceof Error ? error : String(error));
        notifyListenersOfStartupFailure({
          type: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    })();
  }, 1000);
};

export const start: ViteBuilder['start'] = async ({
  startTime,
  options,
  router,
  server: devServer,
}) => {
  moduleGraphRegistrationClosed = true;
  server = await createViteServer(options as Options, devServer);

  router.get('/iframe.html', iframeHandler(options as Options, server));
  router.use(server.middlewares);

  if (listeners.size > 0) {
    // Debounce handler to prevent multiple callback invocations when multiple files are edited
    watcherChangeHandler = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        notifyListeners(buildModuleGraph(server.moduleGraph.fileToModulesMap));
      }, 100);
    };
    // We intentionally don't await this. Cleanup happens in bail().
    void startChangeDetection(options).catch((error) => {
      clearModuleGraphPolling();
      logger.error('Failed to initialize Vite change detection');
      logger.error(error instanceof Error ? error : String(error));
      notifyListenersOfStartupFailure({
        type: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });
  }

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
