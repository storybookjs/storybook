import { getProjectRoot } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { getVirtualModules } from '@storybook/builder-webpack5';

import type { NextConfig } from 'next';
import loadJsConfig from 'next/dist/build/load-jsconfig';
import path from 'path';
import type { Configuration as WebpackConfig } from 'webpack';

export const configureSWCLoader = async (
  baseConfig: WebpackConfig,
  options: Options,
  nextConfig: NextConfig
) => {
  const isDevelopment = options.configType !== 'PRODUCTION';

  const dir = getProjectRoot();

  const { virtualModules } = await getVirtualModules(options);

  const { jsConfig } = await loadJsConfig(dir, nextConfig as any);

  const rawRule = baseConfig.module?.rules?.find(
    (rule) => typeof rule === 'object' && rule?.resourceQuery?.toString() === '/raw/'
  );

  if (rawRule && typeof rawRule === 'object') {
    rawRule.exclude = /^__barrel_optimize__/;
  }

  baseConfig.module?.rules?.push({
    test: /\.((c|m)?(j|t)sx?)$/,
    include: [getProjectRoot()],
    exclude: [/(node_modules)/, ...Object.keys(virtualModules)],
    use: {
      // we use our own patch because we need to remove tracing from the original code
      // which is not possible otherwise
      loader: require.resolve('./swc/next-swc-loader-patch.js'),
      options: {
        isServer: false,
        rootDir: dir,
        pagesDir: `${dir}/pages`,
        appDir: `${dir}/apps`,
        hasReactRefresh: isDevelopment,
        jsConfig,
        nextConfig,
        supportedBrowsers: require('next/dist/build/utils').getSupportedBrowsers(
          dir,
          isDevelopment
        ),
        swcCacheDir: path.join(dir, nextConfig?.distDir ?? '.next', 'cache', 'swc'),
        bundleTarget: 'default',
      },
    },
  });
};
