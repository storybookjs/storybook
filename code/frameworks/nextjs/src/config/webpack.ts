import type { NextConfig } from 'next';
import type { Configuration as WebpackConfig } from 'webpack';

import { addScopedAlias, resolveNextConfig } from '../utils';

const tryResolve = (path: string) => {
  try {
    return require.resolve(path);
  } catch (err) {
    return false;
  }
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
    addScopedAlias(
      baseConfig,
      'react-dom/test-utils',
      'next/dist/compiled/react-dom/cjs/react-dom-test-utils.production.js'
    );
  }
  if (tryResolve('next/dist/compiled/react-dom')) {
    addScopedAlias(baseConfig, 'react-dom$', 'next/dist/compiled/react-dom');
    addScopedAlias(baseConfig, 'react-dom/client', 'next/dist/compiled/react-dom/client');
    addScopedAlias(baseConfig, 'react-dom/server', 'next/dist/compiled/react-dom/server');
  }

  await setupRuntimeConfig(baseConfig, nextConfig);

  return nextConfig;
};

const setupRuntimeConfig = async (
  baseConfig: WebpackConfig,
  nextConfig: NextConfig
): Promise<void> => {
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

  // Load DefinePlugin with a dynamic import to ensure that Next.js can first
  // replace webpack with its own internal instance, and we get that here.
  baseConfig.plugins?.push(new (await import('webpack')).default.DefinePlugin(definePluginConfig));
};
