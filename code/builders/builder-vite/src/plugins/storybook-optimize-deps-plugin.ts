import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import type { Options, StoryIndex } from 'storybook/internal/types';

import { type Plugin, resolveConfig } from 'vite';

import { INCLUDE_CANDIDATES } from '../constants';
import { getUniqueImportPaths } from '../utils/unique-import-paths';

/**
 * A Vite plugin that configures dependency optimization for Storybook's dev server.
 *
 * This handles:
 *
 * - Setting optimizeDeps entries from the story index (so Vite knows which stories to pre-bundle)
 * - Including known CJS dependencies that need to be pre-compiled to ESM
 * - Merging extra optimization dependencies from Storybook presets
 *
 * This plugin only applies in development mode (`command === 'serve'`). In production builds,
 * Rollup handles dependency bundling differently.
 */
export function storybookOptimizeDepsPlugin(options: Options): Plugin {
  return {
    name: 'storybook:optimize-deps-plugin',
    async config(config, { command }) {
      // optimizeDeps only applies to the dev server, not production builds
      if (command !== 'serve') {
        return;
      }

      const [extraOptimizeDeps, storyIndexGenerator] = await Promise.all([
        options.presets.apply('optimizeViteDeps', []),
        options.presets.apply<StoryIndexGenerator>('storyIndexGenerator'),
      ]);

      const index: StoryIndex = await storyIndexGenerator.getIndex();

      const resolvedConfig = await resolveConfig({}, 'serve', 'development');

      const resolve = resolvedConfig.createResolver({ asSrc: false });
      const include = await asyncFilter([...extraOptimizeDeps, ...INCLUDE_CANDIDATES], async (id) =>
        Boolean(await resolve(id))
      );

      return {
        optimizeDeps: {
          // Story file paths as entry points for the optimizer
          entries: getUniqueImportPaths(index),
          // Known CJS dependencies that need to be pre-compiled to ESM,
          // plus any extra deps from Storybook presets.
          include: [...include, ...(config.optimizeDeps?.include || [])],
        },
      };
    },
  };
}

/**
 * Helper function which allows us to `filter` with an async predicate. Uses Promise.all for
 * performance.
 */
async function asyncFilter(arr: string[], predicate: (val: string) => Promise<boolean>) {
  return Promise.all(arr.map(predicate)).then((results) =>
    arr.filter((_v, index) => results[index])
  );
}
