// Writes the bundler's module graph as webpack-style stats for TurboSnap.

import { statSync } from 'node:fs';

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
  // Records the files registered with `this.addWatchFile()`. Only useful when the stats are written.
  recordWatchFiles?: boolean;
};

const ROLLUP_VIRTUAL_PREFIX = '\0';

function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = create();
    map.set(key, value);
  }
  return value;
}

function splitQuery(id: string): [path: string, query: string] {
  const queryIndex = id.indexOf('?');
  return queryIndex === -1 ? [id, ''] : [id.slice(0, queryIndex), id.slice(queryIndex)];
}

const STYLESHEET_EXTENSIONS = 'css|scss|sass|less|styl|stylus|pcss|postcss|sss';
const STYLESHEET_PATH = new RegExp(`\\.(${STYLESHEET_EXTENSIONS})$`);
// The style block of a single-file component, for example `Foo.vue?vue&type=style&lang.scss`.
const STYLESHEET_QUERY = new RegExp(`[?&]lang\\.(${STYLESHEET_EXTENSIONS})\\b`);

function isStylesheet(id: string) {
  const [path, query] = splitQuery(
    id.startsWith(ROLLUP_VIRTUAL_PREFIX) ? id.slice(ROLLUP_VIRTUAL_PREFIX.length) : id
  );
  return STYLESHEET_PATH.test(path) || STYLESHEET_QUERY.test(query);
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

export function pluginWebpackStats({
  workingDir,
  recordWatchFiles = false,
}: WebpackStatsPluginOptions): WebpackStatsPlugin {
  const importersById = new Map<string, Set<string>>();
  const watchFilesById = new Map<string, Set<string>>();
  const isFileById = new Map<string, boolean>();

  // Some files are read by a plugin and only declared with `this.addWatchFile()`, for example a Sass
  // partial or an Angular `templateUrl`. They are never modules, so the bundler graph has no node
  // for them. The bundler does not tell which module declared a watch file, so this wraps the
  // `load` and `transform` hooks to record each call against the id of the module being processed.
  // The id is captured per call, so hooks of different modules can run concurrently.
  function interceptWatchFiles(plugin: Plugin, hookName: keyof typeof MODULE_ID_ARGUMENT) {
    const hook = plugin[hookName] as HookHandler | { handler: HookHandler } | undefined;
    const handler = typeof hook === 'function' ? hook : hook?.handler;
    if (!handler) {
      return;
    }

    const wrapped: HookHandler = function (...args) {
      const id = args[MODULE_ID_ARGUMENT[hookName]] as string;
      const addWatchFile = (file: string) => {
        getOrCreate(watchFilesById, id, () => new Set<string>()).add(file);
        return this.addWatchFile(file);
      };
      const context = new Proxy(this, {
        get(target, property) {
          if (property === 'addWatchFile') {
            return addWatchFile;
          }
          const value = Reflect.get(target, property, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      return handler.apply(context, args);
    };

    try {
      // Object hooks keep their `filter` and `order`.
      (plugin as Record<typeof hookName, unknown>)[hookName] =
        typeof hook === 'function' ? wrapped : { ...hook, handler: wrapped };
    } catch {
      // A frozen plugin, or a hook defined as a getter, keeps its hook. Its watch files are not
      // recorded, but the build does not fail.
    }
  }

  // Plugins may also watch a directory, a glob or a relative path, which TurboSnap cannot match to a
  // changed file. Only absolute paths to existing files are written.
  function isFile(id: string) {
    return getOrCreate(
      isFileById,
      id,
      () => isAbsolute(id) && statSync(id, { throwIfNoEntry: false })?.isFile() === true
    );
  }

  function record(id: string, importer?: string) {
    const importers = getOrCreate(importersById, id, () => new Set<string>());
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
      if (!recordWatchFiles || config.command !== 'build') {
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
      // A watch file is a dependency of the module that declared it. A stylesheet keeps only the
      // stylesheets it watches, such as Sass partials. Its other watch files are content sources,
      // such as the files Tailwind scans for class names: the stories that use those files already
      // trace to them through their imports.
      const keepsOnlyStylesheets = isStylesheet(mod.id);
      for (const file of watchFilesById.get(mod.id) ?? []) {
        if (isFile(file) && (!keepsOnlyStylesheets || isStylesheet(file))) {
          record(file, mod.id);
        }
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
