import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getProjectRoot } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { getVirtualModules } from '@storybook/builder-webpack5';

import type { NextConfig } from 'next';
import nextJSLoadConfigModule from 'next/dist/build/load-jsconfig.js';
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
  const loadJsConfig =
    typeof nextJSLoadConfigModule === 'function'
      ? nextJSLoadConfigModule
      : (nextJSLoadConfigModule as any).default;

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
      loader: fileURLToPath(import.meta.resolve('@storybook/nextjs/next-swc-loader-patch')),
      options: {
        isServer: false,
        rootDir: projectRoot,
        pagesDir: `${projectRoot}/pages`,
        appDir: `${projectRoot}/apps`,
        hasReactRefresh: isDevelopment,
        jsConfig,
        nextConfig,
        supportedBrowsers: (await import('next/dist/build/utils.js')).getSupportedBrowsers(
          projectRoot,
          isDevelopment
        ),
        swcCacheDir: join(projectRoot, nextConfig?.distDir ?? '.next', 'cache', 'swc'),
        bundleTarget: 'default',
      },
    },
  });
};
