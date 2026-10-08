import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';
import type { InlineConfig } from 'vite';

import { createViteLogger } from './logger.ts';
import type { WebpackStatsPlugin } from './plugins/index.ts';
import { hasVitePlugins } from './utils/has-vite-plugins.ts';
import { bundlerOptionsKey } from './utils/vite-features.ts';
import { withoutVitePlugins } from './utils/without-vite-plugins.ts';
import { commonConfig } from './vite-config.ts';

function findPlugin(config: InlineConfig, name: string) {
  return config.plugins?.find((p) => p && 'name' in p && p.name === name);
}

export async function build(options: Options) {
  const { build: viteBuild, mergeConfig } = await import('vite');
  const { presets } = options;

  const config = await commonConfig(options, 'build');

  config.build = mergeConfig(config, {
    build: {
      outDir: options.outputDir,
      emptyOutDir: false, // do not clean before running Vite build - Storybook has already added assets in there!
      // Storybook copies the public dir itself through the `staticDirs` preset so that its own
      // output files and user `staticDirs` take precedence over public assets.
      copyPublicDir: false,
      // TODO: Remove bundlerOptionsKey and use 'rolldownOptions' directly once support for Vite < 8 is dropped
      [bundlerOptionsKey]: {
        external: [/\.\/sb-common-assets\/.*\.woff2/],
      },
      ...(options.test
        ? {
            reportCompressedSize: false,
            sourcemap: !options.build?.test?.disableSourcemaps,
            target: 'esnext',
            treeshake: !options.build?.test?.disableTreeShaking,
          }
        : {}),
    },
  } as InlineConfig).build;

  const finalConfig = (await presets.apply('viteFinal', config, options)) as InlineConfig;

  // Add a plugin to enforce key build properties that may be overwritten
  // by framework plugins like Nitro or Adonis. We run in `enforce: 'post'`
  // both for `config` and `configEnvironment` to ensure we run last.
  finalConfig.plugins?.push({
    name: 'storybook:enforce-build-options',
    enforce: 'post',
    config: () => ({
      build: {
        emptyOutDir: false,
        outDir: options.outputDir,
      },
    }),
    // Our builds only touch the client environment. No need to change build
    // config for other environments at the expense of third-party plugins.
    configEnvironment: (name) =>
      name === 'client'
        ? {
            build: {
              emptyOutDir: false,
              outDir: options.outputDir,
            },
          }
        : null,
  });

  if (options.features?.developmentModeForBuild) {
    finalConfig.plugins?.push({
      name: 'storybook:define-env',
      config: () => {
        return {
          define: {
            'process.env.NODE_ENV': JSON.stringify('development'),
          },
        };
      },
    });
  }

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
