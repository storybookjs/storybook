import { relative } from 'node:path';

import type { Options } from 'storybook/internal/types';

import type { UserConfig, InlineConfig as ViteInlineConfig } from 'vite';

import { listStories } from './list-stories';

export async function getOptimizeDeps(config: ViteInlineConfig, options: Options) {
  const { root = process.cwd() } = config;
  const { normalizePath } = await import('vite');
  const absoluteStories = await listStories(options);
  const stories = absoluteStories.map((storyPath) => normalizePath(relative(root, storyPath)));

  // This function converts ids which might include ` > ` to a real path, if it exists on disk.
  // See https://github.com/vitejs/vite/blob/67d164392e8e9081dc3f0338c4b4b8eea6c5f7da/packages/vite/src/node/optimizer/index.ts#L182-L199
  const optimizeDeps: UserConfig['optimizeDeps'] = {
    ...config.optimizeDeps,
    // We don't need to resolve the glob since vite supports globs for entries.
    entries: stories,
  };

  return optimizeDeps;
}
