import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import type { NextConfigComplete } from 'next/dist/server/config-shared.js';
import nextServerConfig from 'next/dist/server/config.js';
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_TEST,
} from 'next/dist/shared/lib/constants.js';
import type { Plugin } from 'vite';

import { vitePluginNextDynamic } from './plugins/next-dynamic/plugin';
import { vitePluginNextEnv } from './plugins/next-env/plugin';
import { vitePluginNextFont } from './plugins/next-font/plugin';
import { vitePluginNextImage } from './plugins/next-image/plugin';
import { vitePluginNextMocks } from './plugins/next-mocks/plugin';
import { vitePluginNextSwc } from './plugins/next-swc/plugin';
import './polyfills/promise-with-resolvers';
import { getExecutionEnvironment, isVitestEnv } from './utils';

const requirePackage = require || createRequire(import.meta.url);
const loadConfig: typeof nextServerConfig = (nextServerConfig as any).default || nextServerConfig;

type VitePluginOptions = {
  /**
   * Provide the path to your Next.js project directory
   *
   * @default process.cwd()
   */
  dir?: string;
};

export function storybookNextJsPlugin({ dir = process.cwd() }: VitePluginOptions = {}): Plugin[] {
  const resolvedDir = resolve(dir);
  const nextConfigResolver = Promise.withResolvers<NextConfigComplete>();

  return [
    {
      name: 'vite-plugin-storybook-nextjs',
      enforce: 'pre' as const,
      async config(config, env) {
        const phase =
          env.mode === 'development'
            ? PHASE_DEVELOPMENT_SERVER
            : env.mode === 'test'
              ? PHASE_TEST
              : PHASE_PRODUCTION_BUILD;

        nextConfigResolver.resolve(await loadConfig(phase, resolvedDir));

        const executionEnvironment = getExecutionEnvironment(config);

        return {
          ...(!isVitestEnv && {
            resolve: {
              alias: [
                {
                  find: /^react$/,
                  replacement: requirePackage.resolve('next/dist/compiled/react'),
                },
                {
                  find: /^react-dom$/,
                  replacement: requirePackage.resolve('next/dist/compiled/react-dom'),
                },
                {
                  find: /^react-dom\/server$/,
                  replacement: requirePackage.resolve(
                    'next/dist/compiled/react-dom/server.browser.js'
                  ),
                },
                {
                  find: /^react-dom\/test-utils$/,
                  replacement: requirePackage.resolve(
                    'next/dist/compiled/react-dom/cjs/react-dom-test-utils.production.js'
                  ),
                },
                {
                  find: /^react-dom\/client$/,
                  replacement: requirePackage.resolve('next/dist/compiled/react-dom/client.js'),
                },
                {
                  find: /^react-dom\/cjs\/react-dom\.development\.js$/,
                  replacement: requirePackage.resolve(
                    'next/dist/compiled/react-dom/cjs/react-dom.development.js'
                  ),
                },
              ],
            },
          }),
          optimizeDeps: {
            include: [
              '@mdx-js/react',
              '@storybook/blocks',
              'next/dist/compiled/react',
              'next/image',
              'next/legacy/image',
              'react/jsx-dev-runtime',
              'styled-jsx/style',
            ],
          },
          test: {
            alias: {
              'react/jsx-dev-runtime': requirePackage.resolve(
                'next/dist/compiled/react/jsx-dev-runtime.js'
              ),
              'react/jsx-runtime': requirePackage.resolve(
                'next/dist/compiled/react/jsx-runtime.js'
              ),

              react: requirePackage.resolve('next/dist/compiled/react'),

              'react-dom/server': requirePackage.resolve(
                executionEnvironment === 'node'
                  ? 'next/dist/compiled/react-dom/server.js'
                  : 'next/dist/compiled/react-dom/server.browser.js'
              ),

              'react-dom/test-utils': requirePackage.resolve(
                'next/dist/compiled/react-dom/cjs/react-dom-test-utils.production.js'
              ),

              'react-dom/cjs/react-dom.development.js': requirePackage.resolve(
                'next/dist/compiled/react-dom/cjs/react-dom.development.js'
              ),

              'react-dom/client': requirePackage.resolve('next/dist/compiled/react-dom/client.js'),

              'react-dom': requirePackage.resolve('next/dist/compiled/react-dom'),
            },
          },
        };
      },
      configResolved(config) {
        if (isVitestEnv && !config.test?.browser?.enabled) {
          config.test!.setupFiles = [
            requirePackage.resolve('./mocks/storybook.global.js'),
            ...(config.test?.setupFiles ?? []),
          ];
        }
      },
    },
    vitePluginNextFont(),
    vitePluginNextSwc(dir, nextConfigResolver),
    vitePluginNextEnv(dir, nextConfigResolver),
    vitePluginNextImage(nextConfigResolver),
    vitePluginNextMocks(),
    vitePluginNextDynamic(),
  ];
}
