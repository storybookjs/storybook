import { join } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { getVirtualModules } from '@storybook/builder-webpack5';

import type { NextConfig } from 'next';
import loadJsConfig from 'next/dist/build/load-jsconfig';
import type { Configuration as WebpackConfig } from 'webpack';

import { getNodeModulesExcludeRegex } from '../utils';

export const configureSWCLoader = async (
  baseConfig: WebpackConfig,
  options: Options,
  nextConfig: NextConfig
) => {
  const isDevelopment = options.configType !== 'PRODUCTION';

  const { virtualModules } = await getVirtualModules(options);
  const projectRoot = getProjectRoot();

  const { jsConfig } = await loadJsConfig(projectRoot, nextConfig as any);

  const rawRule = baseConfig.module?.rules?.find(
    (rule) => typeof rule === 'object' && rule?.resourceQuery?.toString() === '/raw/'
  );

  if (rawRule && typeof rawRule === 'object') {
    rawRule.exclude = /^__barrel_optimize__/;
  }

  const transpilePackages = nextConfig.transpilePackages ?? [];

  baseConfig.module?.rules?.push({
    test: /\.((c|m)?(j|t)sx?)$/,
    include: [projectRoot],
    exclude: [getNodeModulesExcludeRegex(transpilePackages), ...Object.keys(virtualModules)],
    use: {
      // we use our own patch because we need to remove tracing from the original code
      // which is not possible otherwise
      loader: require.resolve('./swc/next-swc-loader-patch.js'),
      options: {
        isServer: false,
        rootDir: projectRoot,
        pagesDir: `${projectRoot}/pages`,
        appDir: `${projectRoot}/apps`,
        hasReactRefresh: isDevelopment,
        jsConfig,
        nextConfig,
        supportedBrowsers: require('next/dist/build/utils').getSupportedBrowsers(
          projectRoot,
          isDevelopment
        ),
        swcCacheDir: join(projectRoot, nextConfig?.distDir ?? '.next', 'cache', 'swc'),
        bundleTarget: 'default',
      },
    },
  });
};
