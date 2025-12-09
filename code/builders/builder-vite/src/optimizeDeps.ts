import type { StoryIndexGenerator } from 'storybook/internal/core-server';
import type { Options, StoryIndex } from 'storybook/internal/types';

import { type UserConfig, type InlineConfig as ViteInlineConfig, resolveConfig } from 'vite';

import { INCLUDE_CANDIDATES } from './constants';

/**
 * Helper function which allows us to `filter` with an async predicate. Uses Promise.all for
 * performance.
 */
const asyncFilter = async (arr: string[], predicate: (val: string) => Promise<boolean>) =>
  Promise.all(arr.map(predicate)).then((results) => arr.filter((_v, index) => results[index]));

// TODO: This function should be reworked. The code it uses is outdated and we need to investigate
// More info: https://github.com/storybookjs/storybook/issues/32462#issuecomment-3421326557
export async function getOptimizeDeps(config: ViteInlineConfig, options: Options) {
  const [extraOptimizeDeps, storyIndexGenerator] = await Promise.all([
    options.presets.apply('optimizeViteDeps', []),
    options.presets.apply<StoryIndexGenerator>('storyIndexGenerator'),
  ]);

  const index: StoryIndex = (await storyIndexGenerator.getIndex()) ?? {
    v: 5,
    entries: {},
  };

  const storyModulePaths = Object.values(index.entries).map((entry) => entry.importPath);

  // TODO: check if resolveConfig takes a lot of time, possible optimizations here
  const resolvedConfig = await resolveConfig(config, 'serve', 'development');

  // This function converts ids which might include ` > ` to a real path, if it exists on disk.
  // See https://github.com/vitejs/vite/blob/67d164392e8e9081dc3f0338c4b4b8eea6c5f7da/packages/vite/src/node/optimizer/index.ts#L182-L199
  const resolve = resolvedConfig.createResolver({ asSrc: false });
  const include = await asyncFilter(INCLUDE_CANDIDATES, async (id) => Boolean(await resolve(id)));

  const optimizeDeps: UserConfig['optimizeDeps'] = {
    ...config.optimizeDeps,
    entries: storyModulePaths,
    // We need Vite to precompile these dependencies, because they contain non-ESM code that would break
    // if we served it directly to the browser.
    include: [...include, ...extraOptimizeDeps, ...(config.optimizeDeps?.include || [])],
  };

  return optimizeDeps;
}
