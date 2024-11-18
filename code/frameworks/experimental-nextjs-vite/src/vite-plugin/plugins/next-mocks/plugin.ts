import { createRequire } from 'node:module';

import type { Plugin } from 'vite';

import { type Env, getEntryPoint, getExecutionEnvironment } from '../../utils';
import { getCompatibilityAliases } from './compatibility/compatibility-map';

const requirePackage = require || createRequire(import.meta.url);

export const getAlias = (env: Env) => ({
  'next/headers': getEntryPoint('headers', env),
  '@storybook/nextjs/headers.mock': getEntryPoint('headers', env),
  '@storybook/nextjs-vite/headers.mock': getEntryPoint('headers', env),
  '@storybook/experimental-nextjs-vite/headers.mock': getEntryPoint('headers', env),
  'next/navigation': getEntryPoint('navigation', env),
  '@storybook/nextjs/navigation.mock': getEntryPoint('navigation', env),
  '@storybook/nextjs-vite/navigation.mock': getEntryPoint('navigation', env),
  '@storybook/experimental-nextjs-vite/navigation.mock': getEntryPoint('navigation', env),
  'next/router': getEntryPoint('router', env),
  '@storybook/nextjs/router.mock': getEntryPoint('router', env),
  '@storybook/nextjs-vite/router.mock': getEntryPoint('router', env),
  '@storybook/experimental-nextjs-vite/router.mock': getEntryPoint('router', env),
  'next/cache': getEntryPoint('cache', env),
  '@storybook/nextjs/cache.mock': getEntryPoint('cache', env),
  '@storybook/nextjs-vite/cache.mock': getEntryPoint('cache', env),
  '@storybook/experimental-nextjs-vite/cache.mock': getEntryPoint('cache', env),
  'server-only': getEntryPoint('server-only', env),
  '@opentelemetry/api': requirePackage.resolve('next/dist/compiled/@opentelemetry/api'),
  'next/dynamic': getEntryPoint('dynamic', env),
  ...getCompatibilityAliases(),
});

export const vitePluginNextMocks = () =>
  ({
    name: 'vite-plugin-next-mocks',
    config: (config) => {
      const aliasEnv = getExecutionEnvironment(config);
      console.log({ alias: getAlias(aliasEnv) });
      return {
        resolve: {
          alias: getAlias(aliasEnv),
        },
      };
    },
  }) satisfies Plugin;
