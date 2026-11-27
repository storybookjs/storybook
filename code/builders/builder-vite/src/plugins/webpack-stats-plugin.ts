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

function splitQuery(id: string): [path: string, query: string] {
  const queryIndex = id.indexOf('?');
  return queryIndex === -1 ? [id, ''] : [id.slice(0, queryIndex), id.slice(queryIndex)];
}

const STYLESHEET_EXTENSIONS = 'css|scss|sass|less|styl|stylus|pcss|postcss|sss';
const STYLESHEET_PATH = new RegExp(`\\.(${STYLESHEET_EXTENSIONS})$`);
// The style block of a single-file component, for example `Foo.vue?vue&type=style&lang.scss`.
const STYLESHEET_QUERY = new RegExp(`[?&]lang\\.(${STYLESHEET_EXTENSIONS})\\b`);

function isStylesheet(id: string) {
  const [path, query] = splitQuery(id);
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

export type WebpackStatsPlugin = Plugin & { storybookGetStats: () => BuilderStats };

export function pluginWebpackStats({
  workingDir,
  recordWatchFiles = false,
}: WebpackStatsPluginOptions): WebpackStatsPlugin {
  const importersById = new Map<string, Set<string>>();
  const watchFilesById = new Map<string, Set<string>>();
  const isFileById = new Map<string, boolean>();

  function interceptWatchFiles(plugin: Plugin, hookName: 'load' | 'transform') {
    const hook = plugin[hookName];
    if (!hook) {
      return;
    }
    const handler = typeof hook === 'function' ? hook : hook.handler;
    const wrapped = function (this: { addWatchFile(file: string): void }, ...args: unknown[]) {
      const id = args[hookName === 'load' ? 0 : 1] as string;
      const context = new Proxy(this, {
        get(target, key) {
          if (key === 'addWatchFile') {
            return (file: string) => {
              const files = watchFilesById.get(id) ?? new Set<string>();
              files.add(file);
              watchFilesById.set(id, files);
              return target.addWatchFile(file);
            };
          }
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      return Reflect.apply(handler, context, args);
    };
    try {
      (plugin as Record<typeof hookName, unknown>)[hookName] =
        typeof hook === 'function' ? wrapped : { ...hook, handler: wrapped };
    } catch {
      // Non-writable hooks keep their original behavior.
    }
  }

  function record(id: string, importer?: string) {
    const importers = importersById.get(id) ?? new Set<string>();
    importersById.set(id, importers);
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
      // Capture the owning module here because bundlers expose watch files only globally.
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
      // Tailwind's scanned sources must not become dependencies of a global stylesheet.
      const keepsOnlyStylesheets = isStylesheet(mod.id);
      for (const file of watchFilesById.get(mod.id) ?? []) {
        if (keepsOnlyStylesheets && !isStylesheet(file)) {
          continue;
        }
        const isFile =
          isFileById.get(file) ??
          (isAbsolute(file) && statSync(file, { throwIfNoEntry: false })?.isFile() === true);
        isFileById.set(file, isFile);
        if (isFile) {
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
