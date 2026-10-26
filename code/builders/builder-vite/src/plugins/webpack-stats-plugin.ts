// Writes the bundler's module graph as webpack-style stats for TurboSnap.

import type { BuilderStats } from 'storybook/internal/types';

import { isAbsolute, relative } from 'pathe';
import type { Plugin } from 'vite';

/*
 * Reason, Module are copied from chromatic types
 * https://github.com/chromaui/chromatic-cli/blob/145a5e295dde21042e96396c7e004f250d842182/bin-src/types.ts#L265-L276
 */
interface Reason {
  moduleName: string;
}
interface Module {
  id: string | number;
  name: string;
  modules?: Array<Pick<Module, 'name'>>;
  reasons?: Reason[];
}

type WebpackStatsPluginOptions = {
  workingDir: string;
};

const ROLLUP_VIRTUAL_PREFIX = '\0';

function splitQuery(id: string): [path: string, query: string] {
  const queryIndex = id.indexOf('?');
  return queryIndex === -1 ? [id, ''] : [id.slice(0, queryIndex), id.slice(queryIndex)];
}

// Rollup's `\0` marks an id that is not a file, yet the commonjs plugin embeds a file path in its
// proxy ids. A `\0` id is treated as a path only when the graph contains that path as a module.
function createNormalizer(workingDir: string, ids: Iterable<string>) {
  const filePaths = new Set<string>();
  for (const id of ids) {
    if (!id.startsWith(ROLLUP_VIRTUAL_PREFIX)) {
      filePaths.add(splitQuery(id)[0]);
    }
  }

  return function normalize(id: string) {
    const virtualPrefix = id.startsWith(ROLLUP_VIRTUAL_PREFIX) ? ROLLUP_VIRTUAL_PREFIX : '';
    const unprefixed = id.slice(virtualPrefix.length);

    // Turbosnap matches virtual modules by name, and expects the leading forward slash.
    // Reference: https://github.com/chromaui/chromatic-cli/blob/v11.25.2/node-src/lib/getDependentStoryFiles.ts#L53
    if (unprefixed.startsWith('virtual:')) {
      return `/${unprefixed}`;
    }

    const [path, query] = splitQuery(unprefixed);
    if (!isAbsolute(path) || (virtualPrefix && !filePaths.has(path))) {
      return id;
    }

    return `${virtualPrefix}./${relative(workingDir, path)}${query}`;
  };
}

type WatchFileContext = { addWatchFile: (file: string) => void };
type HookHandler = (this: WatchFileContext, ...args: unknown[]) => unknown;

// The module id is an argument of these hooks: `load(id)` and `transform(code, id)`.
const MODULE_ID_ARGUMENT = { load: 0, transform: 1 } as const;

export type WebpackStatsPlugin = Plugin & { storybookGetStats: () => BuilderStats };

export function pluginWebpackStats({ workingDir }: WebpackStatsPluginOptions): WebpackStatsPlugin {
  const importersById = new Map<string, Set<string>>();
  const watchFilesById = new Map<string, Set<string>>();
  // Keeps a hook from being wrapped twice if the config is resolved again.
  const wrappedHandlers = new WeakSet<HookHandler>();

  // Some files are read by a plugin and only declared with `this.addWatchFile()`, for example a Sass
  // partial or an Angular `templateUrl`. They are never modules, so the bundler graph has no node
  // for them. The bundler does not tell which module declared a watch file, so this wraps the
  // `load` and `transform` hooks to record each call against the id of the module being processed.
  // The id is captured per call, so hooks of different modules can run concurrently.
  function interceptWatchFiles(plugin: Plugin, hookName: keyof typeof MODULE_ID_ARGUMENT) {
    const hook = plugin[hookName] as HookHandler | { handler: HookHandler } | undefined;
    const handler = typeof hook === 'function' ? hook : hook?.handler;
    if (!handler || wrappedHandlers.has(handler)) {
      return;
    }

    const wrapped: HookHandler = function (...args) {
      const id = args[MODULE_ID_ARGUMENT[hookName]] as string;
      const context = new Proxy(this, {
        get(target, property) {
          if (property === 'addWatchFile') {
            return (file: string) => {
              const files = watchFilesById.get(id) ?? new Set<string>();
              files.add(file);
              watchFilesById.set(id, files);
              return target.addWatchFile(file);
            };
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      return handler.apply(context, args);
    };
    wrappedHandlers.add(wrapped);

    // Object hooks keep their `filter` and `order`.
    Object.assign(plugin, {
      [hookName]: typeof hook === 'function' ? wrapped : { ...hook, handler: wrapped },
    });
  }

  function record(id: string, importer?: string) {
    let importers = importersById.get(id);
    if (!importers) {
      importers = new Set<string>();
      importersById.set(id, importers);
    }
    if (importer !== undefined) {
      importers.add(importer);
    }
  }

  return {
    name: 'storybook:rollup-plugin-webpack-stats',
    // We want this to run after the vite build plugins (https://vitejs.dev/guide/api-plugin.html#plugin-ordering)
    enforce: 'post',
    configResolved(config) {
      // The stats are only read after a build.
      if (config.command !== 'build') {
        return;
      }
      for (const plugin of config.plugins) {
        interceptWatchFiles(plugin, 'load');
        interceptWatchFiles(plugin, 'transform');
      }
    },
    moduleParsed(mod) {
      record(mod.id);
      for (const depId of mod.importedIds.concat(mod.dynamicallyImportedIds)) {
        record(depId, mod.id);
      }
      // A watch file is a dependency of the module that declared it.
      for (const file of watchFilesById.get(mod.id) ?? []) {
        record(file, mod.id);
      }
    },

    storybookGetStats() {
      const normalize = createNormalizer(workingDir, importersById.keys());
      const importerNamesByName = new Map<string, Set<string>>();

      for (const [id, importers] of importersById) {
        const name = normalize(id);
        const importerNames = importerNamesByName.get(name) ?? new Set<string>();
        for (const importer of importers) {
          importerNames.add(normalize(importer));
        }
        importerNames.delete(name);
        importerNamesByName.set(name, importerNames);
      }

      const modules: Module[] = Array.from(importerNamesByName, ([name, importerNames]) => ({
        id: name,
        name,
        reasons: Array.from(importerNames, (moduleName) => ({ moduleName })),
      }));
      const stats = { modules };
      return { ...stats, toJson: () => stats };
    },
  };
}
