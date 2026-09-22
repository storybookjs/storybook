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

export type WebpackStatsPlugin = Plugin & { storybookGetStats: () => BuilderStats };

export function pluginWebpackStats({ workingDir }: WebpackStatsPluginOptions): WebpackStatsPlugin {
  // Query params and rollup's `\0` prefix stay in the name so the stats have the same nodes as the
  // bundler's graph; the consumer decides how to merge them.
  function normalize(filename: string) {
    const virtualPrefix = filename.startsWith(ROLLUP_VIRTUAL_PREFIX) ? ROLLUP_VIRTUAL_PREFIX : '';
    const id = filename.slice(virtualPrefix.length);

    // Turbosnap matches virtual modules by name, and expects the leading forward slash.
    // Reference: https://github.com/chromaui/chromatic-cli/blob/v11.25.2/node-src/lib/getDependentStoryFiles.ts#L53
    if (id.startsWith('virtual:')) {
      return `/${id}`;
    }

    const queryIndex = id.indexOf('?');
    const path = queryIndex === -1 ? id : id.slice(0, queryIndex);
    const query = queryIndex === -1 ? '' : id.slice(queryIndex);

    // Ids without a path of their own, such as rollup helpers, are connectivity only.
    if (!isAbsolute(path)) {
      return filename;
    }

    return `${virtualPrefix}./${slash(relative(workingDir, path))}${query}`;
  }

  /** Helper to create Reason objects out of a list of string paths */
  function createReasons(importers?: readonly string[]): Reason[] {
    return (importers || []).map((i) => ({ moduleName: normalize(i) }));
  }

  /** Helper function to build a `Module` given a filename and list of files that import it */
  function createStatsMapModule(filename: string, importers?: readonly string[]): Module {
    return {
      id: filename,
      name: filename,
      reasons: createReasons(importers),
    };
  }

  const statsMap = new Map<string, Module>();

  return {
    name: 'storybook:rollup-plugin-webpack-stats',
    // We want this to run after the vite build plugins (https://vitejs.dev/guide/api-plugin.html#plugin-ordering)
    enforce: 'post',
    moduleParsed: function (mod) {
      // Entry modules have no importer, so they are only recorded here.
      const modId = normalize(mod.id);
      if (!statsMap.has(modId)) {
        statsMap.set(modId, createStatsMapModule(modId));
      }

      // Proxy and virtual modules are the only path from a component to its dependencies, so every
      // edge is kept.
      mod.importedIds.concat(mod.dynamicallyImportedIds).forEach((depIdUnsafe) => {
        const depId = normalize(depIdUnsafe);
        if (!statsMap.has(depId)) {
          statsMap.set(depId, createStatsMapModule(depId, [mod.id]));
          return;
        }
        const m = statsMap.get(depId);
        if (!m) {
          return;
        }
        m.reasons = (m.reasons ?? [])
          .concat(createReasons([mod.id]))
          .filter((r) => r.moduleName !== depId);
        statsMap.set(depId, m);
      });
    },

    storybookGetStats() {
      const stats = { modules: Array.from(statsMap.values()) };
      return { ...stats, toJson: () => stats };
    },
  };
}
