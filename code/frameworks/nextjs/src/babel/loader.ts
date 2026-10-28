import { fileURLToPath } from 'node:url';

import { getProjectRoot, resolvePathInStorybookCache } from '@storybook/core/internal/common';
import { getInstanceContext } from '@storybook/core/internal/instance';
import { getPreviewModuleIds } from '@storybook/core/internal/preview-page';
import type { StorybookConfigRaw } from '@storybook/core/internal/types';

import type { TransformOptions } from '@babel/core';
import type { NextConfig } from 'next';

import { getNodeModulesExcludeRegex } from '../utils.ts';

export const configureBabelLoader = async (
  baseConfig: any,
  {
    babelOptions,
    typescriptOptions,
  }: { babelOptions: TransformOptions; typescriptOptions: StorybookConfigRaw['typescript'] },
  nextConfig: NextConfig
) => {
  const previewModuleIds = getPreviewModuleIds(
    'webpack',
    getInstanceContext()?.workingDir ?? process.cwd()
  );

  baseConfig.module.rules = [
    ...baseConfig.module.rules,
    {
      test: typescriptOptions?.skipCompiler ? /\.((c|m)?jsx?)$/ : /\.((c|m)?(j|t)sx?)$/,
      use: [
        {
          loader: fileURLToPath(import.meta.resolve('babel-loader')),
          options: {
            cacheDirectory: resolvePathInStorybookCache('babel'),
            ...babelOptions,
          },
        },
      ],
      include: [getProjectRoot()],
      exclude: [
        getNodeModulesExcludeRegex(nextConfig.transpilePackages ?? []),
        ...Object.values(previewModuleIds),
      ],
    },
  ];
};
