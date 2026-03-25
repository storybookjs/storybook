// noinspection JSUnusedGlobalSymbols
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { NoStatsForViteDevError } from 'storybook/internal/server-errors';
import type {
  Builder,
  Middleware,
  ModuleGraph,
  ModuleNode,
  Options,
} from 'storybook/internal/types';

import type { ViteDevServer, ModuleNode as ViteModuleNode } from 'vite';

import { build as viteBuild } from './build';
import type { ViteBuilder } from './types';
import { createViteServer } from './vite-server';

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

export function buildModuleGraph(
  fileToModulesMap: ViteDevServer['moduleGraph']['fileToModulesMap']
): ModuleGraph {
  const moduleGraph: ModuleGraph = new Map();
  const moduleNodeMap = new WeakMap<object, ModuleNode>();

  const getOrCreateModuleNode = (
    viteModuleNode: {
      file: string | null;
      type: ViteModuleNode['type'];
      importers: Set<ViteModuleNode>;
      importedModules: Set<ViteModuleNode>;
    },
    fallbackFile?: string
  ): ModuleNode | undefined => {
    const file = viteModuleNode.file ?? fallbackFile;
    if (!file) {
      return undefined;
    }

    const existingNode = moduleNodeMap.get(viteModuleNode);
    if (existingNode) {
      return existingNode;
    }

    const moduleNode: ModuleNode = {
      file,
      type: viteModuleNode.type,
      importers: new Set(),
      importedModules: new Set(),
    };
    moduleNodeMap.set(viteModuleNode, moduleNode);

    const moduleSet = moduleGraph.get(file) ?? new Set<ModuleNode>();
    moduleSet.add(moduleNode);
    moduleGraph.set(file, moduleSet);

    return moduleNode;
  };

  fileToModulesMap.forEach((viteModuleSet, filePath) => {
    viteModuleSet.forEach((viteModuleNode) => {
      const moduleNode = getOrCreateModuleNode(viteModuleNode, filePath);
      if (moduleNode) {
        viteModuleNode.importers.forEach((importer) => {
          const importerNode = getOrCreateModuleNode(importer);
          if (importerNode) {
            moduleNode.importers.add(importerNode);
          }
        });
        viteModuleNode.importedModules.forEach((importedModule) => {
          const importedModuleNode = getOrCreateModuleNode(importedModule);
          if (importedModuleNode) {
            moduleNode.importedModules.add(importedModuleNode);
          }
        });
      }
    });
  });

  return moduleGraph;
}

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
