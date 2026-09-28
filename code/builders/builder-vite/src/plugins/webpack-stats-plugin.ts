// Writes the bundler's module graph as webpack-style stats for TurboSnap.
import { isAbsolute, relative } from 'node:path';

import type { BuilderStats } from 'storybook/internal/types';

// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';
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

type StatsModule = Module & { reasons: Reason[] };

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

    return `${virtualPrefix}./${slash(relative(workingDir, path))}${query}`;
  };
}

export type WebpackStatsPlugin = Plugin & { storybookGetStats: () => BuilderStats };

export function pluginWebpackStats({ workingDir }: WebpackStatsPluginOptions): WebpackStatsPlugin {
  const importersById = new Map<string, Set<string>>();

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
    moduleParsed(mod) {
      record(mod.id);
      for (const depId of mod.importedIds.concat(mod.dynamicallyImportedIds)) {
        record(depId, mod.id);
      }
    },

    storybookGetStats() {
      const normalize = createNormalizer(workingDir, importersById.keys());
      const modulesByName = new Map<string, StatsModule>();

      for (const [id, importers] of importersById) {
        const name = normalize(id);
        const module = modulesByName.get(name) ?? { id: name, name, reasons: [] };
        for (const importer of importers) {
          const moduleName = normalize(importer);
          if (moduleName !== name) {
            module.reasons.push({ moduleName });
          }
        }
        modulesByName.set(name, module);
      }

      const stats = { modules: Array.from(modulesByName.values()) };
      return { ...stats, toJson: () => stats };
    },
  };
}
