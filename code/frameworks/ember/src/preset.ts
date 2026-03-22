import { getProjectRoot, resolvePathInStorybookCache, getBuilderOptions } from 'storybook/internal/common';
import type { PresetProperty } from 'storybook/internal/types';

import { getVirtualModules } from '@storybook/builder-webpack5';

import type { StorybookConfig } from './types';



export const addons: PresetProperty<'addons'> = [
  import.meta.resolve('@storybook/ember/server/framework-preset-babel-ember'),
];

export const webpackFinal: StorybookConfig['webpackFinal'] = async (baseConfig, options) => {
  const { virtualModules } = await getVirtualModules(options);

  const babelOptions = await options.presets.apply('babel', {}, options);
  const typescriptOptions = await options.presets.apply('typescript', {}, options);

  return {
    ...baseConfig,
    module: {
      ...baseConfig.module,
      rules: [
        ...(baseConfig.module?.rules ?? []),
        {
          test: typescriptOptions.skipCompiler ? /\.((c|m)?jsx?)$/ : /\.((c|m)?(j|t)sx?)$/,
          use: [
            {
              loader: import.meta.resolve('babel-loader'),
              options: {
                cacheDirectory: resolvePathInStorybookCache('babel'),
                ...babelOptions,
              },
            },
          ],
          include: [getProjectRoot()],
          exclude: [/node_modules/, ...Object.keys(virtualModules)],
        },
      ],
    },
  };
};

export const core: PresetProperty<'core'> = async (config, options) => {

  return {
    ...config,
    builder: {
      name: import.meta.resolve('@storybook/builder-webpack5'),
      options: await getBuilderOptions(options),
    },
  };
};
