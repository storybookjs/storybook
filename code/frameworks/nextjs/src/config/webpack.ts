import { createRequire } from 'node:module';

import type { NextConfig } from 'next';
import type { Configuration as WebpackConfig } from 'webpack';
import { DefinePlugin } from 'webpack';

import { addScopedAlias, resolveNextConfig, setAlias } from '../utils';

const tryResolve = (path: string) => {
  try {
    return import.meta.resolve(path);
  } catch (err) {
    //
  }
  try {
    const require = createRequire(import.meta.url);
    return require.resolve(path);
  } catch (err) {
    //
  }
  return false;
};

export const configureConfig = async ({
  baseConfig,
  nextConfigPath,
}: {
  baseConfig: WebpackConfig;
  nextConfigPath?: string;
}): Promise<NextConfig> => {
  const nextConfig = await resolveNextConfig({ nextConfigPath });

  addScopedAlias(baseConfig, 'next/config');

  // @ts-expect-error We know that alias is an object
  if (baseConfig.resolve?.alias?.['react-dom']) {
    // Removing the alias to react-dom to avoid conflicts with the alias we are setting
    // because the react-dom alias is an exact match and we need to alias separate parts of react-dom
    // in different places
    // @ts-expect-error We know that alias is an object
    delete baseConfig.resolve.alias?.['react-dom'];
  }

  if (tryResolve('next/dist/compiled/react')) {
    addScopedAlias(baseConfig, 'react', 'next/dist/compiled/react');
  }
  if (tryResolve('next/dist/compiled/react-dom/cjs/react-dom-test-utils.production.js')) {
    setAlias(
      baseConfig,
      'react-dom/test-utils',
      'next/dist/compiled/react-dom/cjs/react-dom-test-utils.production.js'
    );
  }
  if (tryResolve('next/dist/compiled/react-dom')) {
    setAlias(baseConfig, 'react-dom$', 'next/dist/compiled/react-dom');
    setAlias(baseConfig, 'react-dom/client', 'next/dist/compiled/react-dom/client');
    setAlias(baseConfig, 'react-dom/server', 'next/dist/compiled/react-dom/server');
  }

  setupRuntimeConfig(baseConfig, nextConfig);

  return nextConfig;
};

const setupRuntimeConfig = (baseConfig: WebpackConfig, nextConfig: NextConfig): void => {
  const definePluginConfig: Record<string, any> = {
    // this mimics what nextjs does client side
    // https://github.com/vercel/next.js/blob/57702cb2a9a9dba4b552e0007c16449cf36cfb44/packages/next/client/index.tsx#L101
    'process.env.__NEXT_RUNTIME_CONFIG': JSON.stringify({
      serverRuntimeConfig: {},
      publicRuntimeConfig: nextConfig.publicRuntimeConfig,
    }),
  };

  const newNextLinkBehavior = (nextConfig.experimental as any)?.newNextLinkBehavior;

  definePluginConfig['process.env.__NEXT_NEW_LINK_BEHAVIOR'] = newNextLinkBehavior;

  baseConfig.plugins?.push(new DefinePlugin(definePluginConfig));
};
