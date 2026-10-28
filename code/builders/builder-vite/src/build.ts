import './hooks.ts';

import type { Storybook } from '@storybook/core';
import { logger } from '@storybook/core/internal/node-logger';
import type { BuilderStats } from '@storybook/core/internal/types';

import { dedent } from 'ts-dedent';
import type { InlineConfig } from 'vite';

import { createViteLogger } from './logger.ts';
import type { WebpackStatsPlugin } from './plugins/index.ts';
import { hasVitePlugins } from './utils/has-vite-plugins.ts';
import { bundlerOptionsKey } from './utils/vite-features.ts';
import { withoutVitePlugins } from './utils/without-vite-plugins.ts';
import { commonConfig, getViteHookContext, type ViteConfigInput } from './vite-config.ts';

function findPlugin(config: InlineConfig, name: string) {
  return config.plugins?.find((p) => p && 'name' in p && p.name === name);
}

export async function build(
  storybook: Storybook,
  input: ViteConfigInput & { outDir: string }
): Promise<BuilderStats | undefined> {
  const { build: viteBuild, mergeConfig } = await import('vite');
  const { outDir } = input;
  const { test, build: buildOptions } = storybook.options;

  const config = await commonConfig(storybook, input, 'build');

  config.build = mergeConfig(config, {
    build: {
      outDir,
      emptyOutDir: false, // do not clean before running Vite build - Storybook has already added assets in there!
      // Storybook copies the public dir itself through the `staticDirs` preset so that its own
      // output files and user `staticDirs` take precedence over public assets.
      copyPublicDir: false,
      // TODO: Remove bundlerOptionsKey and use 'rolldownOptions' directly once support for Vite < 8 is dropped
      [bundlerOptionsKey]: {
        external: [/\.\/sb-common-assets\/.*\.woff2/],
      },
      ...(test
        ? {
            reportCompressedSize: false,
            sourcemap: !buildOptions?.test?.disableSourcemaps,
            target: 'esnext',
            treeshake: !buildOptions?.test?.disableTreeShaking,
          }
        : {}),
    },
  } as InlineConfig).build;

  const finalConfig = await storybook.callHook(
    'builder:vite:extend',
    config,
    getViteHookContext(storybook)
  );

  // Add a plugin to enforce key build properties that may be overwritten
  // by framework plugins like Nitro or Adonis. We run in `enforce: 'post'`
  // both for `config` and `configEnvironment` to ensure we run last.
  finalConfig.plugins?.push({
    name: 'storybook:enforce-build-options',
    enforce: 'post',
    config: () => ({
      build: {
        emptyOutDir: false,
        outDir,
      },
    }),
    // Our builds only touch the client environment. No need to change build
    // config for other environments at the expense of third-party plugins.
    configEnvironment: (name) =>
      name === 'client'
        ? {
            build: {
              emptyOutDir: false,
              outDir,
            },
          }
        : null,
  });

  const turbosnapPluginName = 'rollup-plugin-turbosnap';
  const hasTurbosnapPlugin =
    finalConfig.plugins && (await hasVitePlugins(finalConfig.plugins, [turbosnapPluginName]));
  if (hasTurbosnapPlugin) {
    logger.warn(dedent`Found '${turbosnapPluginName}' which is now included by default in Storybook 8.
      Removing from your plugins list. Ensure you pass \`--stats-json\` to generate stats.

      For more information, see https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#turbosnap-vite-plugin-is-no-longer-needed`);

    finalConfig.plugins = await withoutVitePlugins(finalConfig.plugins, [turbosnapPluginName]);
  }

  finalConfig.customLogger ??= await createViteLogger();

  await viteBuild(finalConfig);

  const statsPlugin = findPlugin(
    finalConfig,
    'storybook:rollup-plugin-webpack-stats'
  ) as WebpackStatsPlugin;
  return statsPlugin?.storybookGetStats();
}
