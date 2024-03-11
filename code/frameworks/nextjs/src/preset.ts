// https://storybook.js.org/docs/react/addons/writing-presets
import { dirname, join } from 'path';
import type { PresetProperty } from '@storybook/types';
import type { ConfigItem, PluginItem, TransformOptions } from '@babel/core';
import { loadPartialConfig } from '@babel/core';
import { getProjectRoot } from '@storybook/core-common';
import { configureConfig } from './config/webpack';
import { configureCss } from './css/webpack';
import { configureImports } from './imports/webpack';
import { configureStyledJsx } from './styledJsx/webpack';
import { configureImages } from './images/webpack';
import { configureRuntimeNextjsVersionResolution } from './utils';
import type { FrameworkOptions, StorybookConfig } from './types';
import { configureNextImport } from './nextImport/webpack';
import TransformFontImports from './font/babel';
import { configureNextFont } from './font/webpack/configureNextFont';
import nextBabelPreset from './babel/preset';
import { configureNodePolyfills } from './nodePolyfills/webpack';
import { configureAliasing } from './dependency-map';
import { configureSWCLoader } from './swc/loader';

export const addons: PresetProperty<'addons', StorybookConfig> = [
  dirname(require.resolve(join('@storybook/preset-react-webpack', 'package.json'))),
];

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

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

export const previewAnnotations: StorybookConfig['previewAnnotations'] = (entry = []) => [
  ...entry,
  join(dirname(require.resolve('@storybook/nextjs/package.json')), 'dist/preview.mjs'),
];

// Not even sb init - automigrate - running dev
// You're using a version of Nextjs prior to v10, which is unsupported by this framework.

export const babel = async (baseConfig: TransformOptions): Promise<TransformOptions> => {
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
  };
};

export const webpackFinal: StorybookConfig['webpackFinal'] = async (baseConfig, options) => {
  const { builder, nextConfigPath } = await options.presets.apply<FrameworkOptions>(
    'frameworkOptions'
  );

  const nextConfig = await configureConfig({
    baseConfig,
    nextConfigPath,
    configDir: options.configDir,
  });

  configureAliasing(baseConfig);
  configureNextFont(baseConfig, builder?.useSWC);
  configureNextImport(baseConfig);
  configureRuntimeNextjsVersionResolution(baseConfig);
  configureImports({ baseConfig, configDir: options.configDir });
  configureCss(baseConfig, nextConfig);
  configureImages(baseConfig, nextConfig);
  configureStyledJsx(baseConfig);
  configureNodePolyfills(baseConfig);

  // TODO: In Storybook 8.0, we have to check whether the babel-compiler addon is used. Otherwise, swc should be used.
  if (builder?.useSWC) {
    await configureSWCLoader(baseConfig, options, nextConfig);
  }

  return baseConfig;
};
