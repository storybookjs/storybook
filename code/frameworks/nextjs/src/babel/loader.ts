import { getProjectRoot, resolvePathInStorybookCache } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { getVirtualModules } from '@storybook/builder-webpack5';

import type { NextConfig } from 'next';

import { getNodeModulesExcludeRegex } from '../utils';

export const configureBabelLoader = async (
  baseConfig: any,
  options: Options,
  nextConfig: NextConfig
) => {
  const { virtualModules } = await getVirtualModules(options);

  const babelOptions = await options.presets.apply('babel', {}, options);
  const typescriptOptions = await options.presets.apply('typescript', {}, options);

  baseConfig.module.rules = [
    ...baseConfig.module.rules,
    {
      test: typescriptOptions.skipCompiler ? /\.((c|m)?jsx?)$/ : /\.((c|m)?(j|t)sx?)$/,
      use: [
        {
          loader: require.resolve('babel-loader'),
          options: {
            cacheDirectory: resolvePathInStorybookCache('babel'),
            ...babelOptions,
          },
        },
      ],
      include: [getProjectRoot()],
      exclude: [
        getNodeModulesExcludeRegex(nextConfig.transpilePackages ?? []),
        ...Object.keys(virtualModules),
      ],
    },
  ];
};
