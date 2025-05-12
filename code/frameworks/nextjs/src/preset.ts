// https://storybook.js.org/docs/react/addons/writing-presets
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { PresetProperty } from 'storybook/internal/types';

import type { ConfigItem, PluginItem, TransformOptions } from '@babel/core';
import { loadPartialConfig } from '@babel/core';
import semver from 'semver';

import nextBabelPreset from './babel/preset';
import { configureConfig } from './config/webpack';
import TransformFontImports from './font/babel';
import type { FrameworkOptions, StorybookConfig } from './types';

export const addons: PresetProperty<'addons'> = [
  dirname(require.resolve(join('@storybook/preset-react-webpack', 'package.json'))),
];

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply<StorybookConfig['framework']>('framework');

  // Load the Next.js configuration before we need it in webpackFinal (below).
  // This gives Next.js an opportunity to override some of webpack's internals
  // (see next/dist/server/config-utils.js) before @storybook/builder-webpack5
  // starts to use it. Without this, webpack's file system cache (fsCache: true)
  // does not work.
  await configureConfig({
    // Pass in a dummy webpack config object for now, since we don't want to
    // modify the real one yet. We pass in the real one in webpackFinal.
    baseConfig: {},
    nextConfigPath: typeof framework === 'string' ? undefined : framework.options.nextConfigPath,
  });

  return {
    ...config,
    builder: {
      name: dirname(
        require.resolve(join('@storybook/builder-webpack5', 'package.json'))
      ) as '@storybook/builder-webpack5',
      options: {
        ...(typeof framework === 'string' ? {} : framework.options.builder || {}),
      },
    },
    renderer: dirname(require.resolve(join('@storybook/react', 'package.json'))),
  };
};

export const previewAnnotations: PresetProperty<'previewAnnotations'> = (
  entry = [],
  { features }
) => {
  const nextDir = dirname(require.resolve('@storybook/nextjs/package.json'));
  const result = [...entry, join(nextDir, 'dist/preview.mjs')];
  return result;
};

export const babel: PresetProperty<'babel'> = async (baseConfig: TransformOptions) => {
  const configPartial = loadPartialConfig({
    ...baseConfig,
    filename: `${getProjectRoot()}/__fake__.js`,
  });

  const options = configPartial?.options;

  const isPresetConfigItem = (preset: any): preset is ConfigItem => {
    return typeof preset === 'object' && preset !== null && 'file' in preset;
  };

  const isNextBabelConfig = (preset: PluginItem) =>
    (Array.isArray(preset) && preset[0] === 'next/babel') ||
    preset === 'next/babel' ||
    (isPresetConfigItem(preset) && preset.file?.request === 'next/babel');

  const hasNextBabelConfig = options?.presets?.find(isNextBabelConfig);

  const presets =
    options?.presets?.filter(
      (preset) =>
        !(
          (isPresetConfigItem(preset) &&
            (preset as ConfigItem).file?.request === require.resolve('@babel/preset-react')) ||
          isNextBabelConfig(preset)
        )
    ) ?? [];

  if (hasNextBabelConfig) {
    if (Array.isArray(hasNextBabelConfig) && hasNextBabelConfig[1]) {
      presets.push([nextBabelPreset, hasNextBabelConfig[1]]);
    } else if (
      isPresetConfigItem(hasNextBabelConfig) &&
      hasNextBabelConfig.file?.request === 'next/babel'
    ) {
      presets.push([nextBabelPreset, hasNextBabelConfig.options]);
    } else {
      presets.push(nextBabelPreset);
    }
  } else {
    presets.push(nextBabelPreset);
  }

  const plugins = [...(options?.plugins ?? []), TransformFontImports];

  return {
    ...options,
    plugins,
    presets,
    babelrc: false,
    configFile: false,
    overrides: [
      ...(options?.overrides ?? []),
      // We need to re-apply the default storybook babel override from:
      // https://github.com/storybookjs/storybook/blob/next/code/core/src/core-server/presets/common-preset.ts
      // Because it get lost in the loadPartialConfig call above.
      // See https://github.com/storybookjs/storybook/issues/28467
      {
        include: /(story|stories)\.[cm]?[jt]sx?$/,
        presets: [
          [
            'next/dist/compiled/babel/preset-env',
            {
              bugfixes: true,
              targets: {
                chrome: 100,
                safari: 15,
                firefox: 91,
              },
            },
          ],
        ],
      },
    ],
  };
};

export const webpackFinal: StorybookConfig['webpackFinal'] = async (baseConfig, options) => {
  const { nextConfigPath } = await options.presets.apply<FrameworkOptions>('frameworkOptions');
  const nextConfig = await configureConfig({
    baseConfig,
    nextConfigPath,
  });

  // Use dynamic imports to ensure these modules that use webpack load after
  // Next.js has been configured (above), and has replaced webpack with its precompiled
  // version.
  const { configureNextFont } = await import('./font/webpack/configureNextFont');
  const { configureRuntimeNextjsVersionResolution, getNextjsVersion } = await import('./utils');
  const { configureImports } = await import('./imports/webpack');
  const { configureCss } = await import('./css/webpack');
  const { configureImages } = await import('./images/webpack');
  const { configureStyledJsx } = await import('./styledJsx/webpack');
  const { configureNodePolyfills } = await import('./nodePolyfills/webpack');
  const { configureAliases } = await import('./aliases/webpack');
  const { configureFastRefresh } = await import('./fastRefresh/webpack');
  const { configureRSC } = await import('./rsc/webpack');
  const { configureSWCLoader } = await import('./swc/loader');
  const { configureBabelLoader } = await import('./babel/loader');

  const babelRCPath = join(getProjectRoot(), '.babelrc');
  const babelConfigPath = join(getProjectRoot(), 'babel.config.js');
  const hasBabelConfig = existsSync(babelRCPath) || existsSync(babelConfigPath);
  const nextjsVersion = getNextjsVersion();
  const isDevelopment = options.configType !== 'PRODUCTION';

  const isNext14orNewer = semver.gte(nextjsVersion, '14.0.0');
  const useSWC =
    isNext14orNewer && (nextConfig.experimental?.forceSwcTransforms || !hasBabelConfig);

  configureNextFont(baseConfig, useSWC);
  configureRuntimeNextjsVersionResolution(baseConfig);
  configureImports({ baseConfig, configDir: options.configDir });
  configureCss(baseConfig, nextConfig);
  configureImages(baseConfig, nextConfig);
  configureStyledJsx(baseConfig);
  configureNodePolyfills(baseConfig);
  configureAliases(baseConfig);

  if (isDevelopment) {
    configureFastRefresh(baseConfig);
  }

  if (options.features?.experimentalRSC) {
    configureRSC(baseConfig);
  }

  if (useSWC) {
    logger.info('=> Using SWC as compiler');
    await configureSWCLoader(baseConfig, options, nextConfig);
  } else {
    logger.info('=> Using Babel as compiler');
    await configureBabelLoader(baseConfig, options);
  }

  return baseConfig;
};
