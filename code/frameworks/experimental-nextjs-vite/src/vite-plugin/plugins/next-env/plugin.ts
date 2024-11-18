/* eslint-disable no-underscore-dangle */
import { resolve } from 'node:path';

import type { Env } from '@next/env';
import { getDefineEnv } from 'next/dist/build/webpack/plugins/define-env-plugin.js';
import type { NextConfigComplete } from 'next/dist/server/config-shared.js';
import type { Plugin } from 'vite';

import * as NextUtils from '../../utils/nextjs';

export function vitePluginNextEnv(
  rootDir: string,
  nextConfigResolver: PromiseWithResolvers<NextConfigComplete>
) {
  let envConfig: Env;
  let isDev: boolean;

  const resolvedDir = resolve(rootDir);

  return {
    name: 'vite-plugin-storybook-nextjs-env',
    enforce: 'pre' as const,
    async config(config, env) {
      isDev = env.mode !== 'production';
      envConfig = (await NextUtils.loadEnvironmentConfig(resolvedDir, isDev)).combinedEnv;

      const nextConfig = await nextConfigResolver.promise;

      const publicNextEnvMap = Object.fromEntries(
        Object.entries(envConfig)
          .filter(([key]) => key.startsWith('NEXT_PUBLIC_'))
          .map(([key, value]) => {
            return [`process.env.${key}`, JSON.stringify(value)];
          })
      );

      const finalConfig = {
        ...config.define,
        ...publicNextEnvMap,
        ...getDefineEnv({
          isTurbopack: false,
          config: nextConfig,
          isClient: true,
          isEdgeServer: false,
          isNodeOrEdgeCompilation: false,
          isNodeServer: false,
          clientRouterFilters: undefined,
          dev: isDev,
          middlewareMatchers: undefined,
          hasRewrites: false,
          distDir: nextConfig.distDir,
          fetchCacheKeyPrefix: nextConfig?.experimental?.fetchCacheKeyPrefix,
        }),
      };

      // NEXT_IMAGE_OPTS is used by next/image to pass options to the loader
      // it doesn't get properly serialized by Vitest (Vite seems to be fine) so we need to remove it
      // for now
      delete process.env.__NEXT_IMAGE_OPTS;
      delete finalConfig['process.env.__NEXT_IMAGE_OPTS'];

      return {
        define: finalConfig,
        test: {
          deps: {
            optimizer: {
              ssr: {
                include: ['next'],
              },
            },
          },
        },
      };
    },
  } satisfies Plugin;
}
