import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getProjectRoot } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { getVirtualModules } from '@storybook/builder-webpack5';

import type { NextConfig } from 'next';
import nextJSLoadConfigModule from 'next/dist/build/load-jsconfig.js';
import type { Configuration as WebpackConfig, RuleSetUseFunction } from 'webpack';

import { getNodeModulesExcludeRegex } from '../utils.ts';

export const configureSWCLoader = async (
  baseConfig: WebpackConfig,
  options: Options,
  nextConfig: NextConfig
) => {
  const isDevelopment = options.configType !== 'PRODUCTION';

  const { virtualModules } = await getVirtualModules(options);
  const projectRoot = getProjectRoot();
  const loadJsConfig = (nextJSLoadConfigModule as any).default ?? nextJSLoadConfigModule;

  const { jsConfig } = await loadJsConfig(projectRoot, nextConfig as any);

  const rawRule = baseConfig.module?.rules?.find(
    (rule) => typeof rule === 'object' && rule?.resourceQuery?.toString() === '/raw/'
  );

  if (rawRule && typeof rawRule === 'object') {
    rawRule.exclude = /^__barrel_optimize__/;
  }

  const optimizePackageImports = nextConfig?.experimental?.optimizePackageImports ?? [];
  const swcCacheDir = join(projectRoot, nextConfig?.distDir ?? '.next', 'cache', 'swc');

  if (optimizePackageImports.length > 0) {
    // swc implements `optimizePackageImports` by rewriting named imports of the
    // configured packages into `__barrel_optimize__?names=…!=!<import>` requests
    // (see `autoModularizeImports` in `next/dist/build/swc/options.js`). Next.js
    // serves those requests with the `next-barrel-loader` it registers in its own
    // webpack config. Without a loader the request falls through to the
    // unoptimized barrel file, so every export of that barrel - including
    // server-only code - ends up in the bundle and fails to resolve.
    // https://github.com/storybookjs/storybook/issues/30126
    const barrelLoader = fileURLToPath(
      import.meta.resolve('next/dist/build/webpack/loaders/next-barrel-loader.js')
    );

    baseConfig.module?.rules?.unshift({
      // Next.js registers this rule before its other rules, because the barrel
      // loader emits code that might still need to be transformed.
      test: /__barrel_optimize__/,
      // webpack hands the request being matched to a `use` callback, so the parameter
      // is webpack's own effect data rather than a shape invented here.
      use: ({ resourceQuery = '' }: Parameters<RuleSetUseFunction>[0]) => {
        const names = (resourceQuery.match(/\?names=([^&]+)/)?.[1] ?? '').split(',');
        return [
          {
            loader: barrelLoader,
            options: { names, swcCacheDir },
            // This is part of the request value to serve as the module key.
            ident: `next-barrel-loader:${resourceQuery}`,
          },
        ];
      },
    });
  }

  const transpilePackages = nextConfig.transpilePackages ?? [];

  baseConfig.module?.rules?.push({
    test: /\.((c|m)?(j|t)sx?)$/,
    include: [projectRoot],
    exclude: [getNodeModulesExcludeRegex(transpilePackages), ...Object.keys(virtualModules)],
    use: {
      // we use our own patch because we need to remove tracing from the original code
      // which is not possible otherwise
      loader: '@storybook/nextjs/next-swc-loader-patch',
      options: {
        isServer: false,
        rootDir: projectRoot,
        pagesDir: `${projectRoot}/pages`,
        appDir: `${projectRoot}/apps`,
        hasReactRefresh: isDevelopment,
        jsConfig,
        nextConfig,
        supportedBrowsers: await getSupportedBrowsers(projectRoot, isDevelopment),
        swcCacheDir,
        bundleTarget: 'default',
      },
    },
  });
};

async function getSupportedBrowsers(projectRoot: string, isDevelopment: boolean) {
  try {
    // @ts-expect-error - Correct import since Next.js v16.2
    return (await import('next/dist/build/get-supported-browsers.js')).getSupportedBrowsers(
      projectRoot,
      isDevelopment
    );
  } catch (e) {
    // TODO: Remove as soon as we don't have to support Next.js < 16.2 anymore
    return (await import('next/dist/build/utils.js')).getSupportedBrowsers(
      projectRoot,
      isDevelopment
    );
  }
}
