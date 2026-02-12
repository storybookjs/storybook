import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import type { Options, StoryIndex } from 'storybook/internal/types';

import { type Plugin } from 'vite';

import { getUniqueImportPaths } from '../utils/unique-import-paths';

/** A Vite plugin that configures dependency optimization for Storybook's dev server. */
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

      return {
        optimizeDeps: {
          // Story file paths as entry points for the optimizer
          entries: getUniqueImportPaths(index),
          // Known CJS dependencies that need to be pre-compiled to ESM,
          // plus any extra deps from Storybook presets.
          include: [...extraOptimizeDeps, ...(config.optimizeDeps?.include || [])],
        },
      };
    },
  };
}
