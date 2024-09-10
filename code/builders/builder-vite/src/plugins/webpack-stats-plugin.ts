// This plugin is a direct port of https://github.com/IanVS/vite-plugin-turbosnap
import { relative } from 'node:path';

import type { BuilderStats } from 'storybook/internal/types';

import slash from 'slash';
import type { Plugin } from 'vite';

import {
  SB_VIRTUAL_FILES,
  getOriginalVirtualModuleId,
  getResolvedVirtualModuleId,
} from '../virtual-file-names';

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

/**
 * Strips off query params added by rollup/vite to ids, to make paths compatible for comparison with
 * git.
 */
function stripQueryParams(filePath: string): string {
  return filePath.split('?')[0];
}

/** We only care about user code, not node_modules, vite files, or (most) virtual files. */
function isUserCode(moduleName: string) {
  if (!moduleName) {
    return false;
  }

  // keep Storybook's virtual files because they import the story files, so they are essential to the module graph
  if (Object.values(SB_VIRTUAL_FILES).includes(getOriginalVirtualModuleId(moduleName))) {
    return true;
  }

  return Boolean(
    !moduleName.startsWith('vite/') &&
      !moduleName.startsWith('\0') &&
      moduleName !== 'react/jsx-runtime' &&
      !moduleName.match(/node_modules\//)
  );
}

export type WebpackStatsPlugin = Plugin & { storybookGetStats: () => BuilderStats };

export function pluginWebpackStats({ workingDir }: WebpackStatsPluginOptions): WebpackStatsPlugin {
  /** Convert an absolute path name to a path relative to the vite root, with a starting `./` */
  function normalize(filename: string) {
    // Do not try to resolve virtual files
    if (filename.startsWith('/virtual:')) {
      return filename;
    }
    // ! Maintain backwards compatibility with the old virtual file names
    // ! to ensure that the stats file doesn't change between the versions
    // ! Turbosnap is also only compatible with the old virtual file names
    // ! the old virtual file names did not start with the obligatory \0 character
    if (Object.values(SB_VIRTUAL_FILES).includes(getOriginalVirtualModuleId(filename))) {
      return getOriginalVirtualModuleId(filename);
    }

    // Otherwise, we need them in the format `./path/to/file.js`.
    else {
      const relativePath = relative(workingDir, stripQueryParams(filename));
      // This seems hacky, got to be a better way to add a `./` to the start of a path.
      return `./${slash(relativePath)}`;
    }
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
      if (!isUserCode(mod.id)) {
        return;
      }
      mod.importedIds
        .concat(mod.dynamicallyImportedIds)
        .filter((name) => isUserCode(name))
        .forEach((depIdUnsafe) => {
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
