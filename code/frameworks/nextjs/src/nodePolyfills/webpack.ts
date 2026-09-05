import { createRequire } from 'node:module';
import type { Configuration } from 'webpack';
import webpack from 'webpack';

const NODE_PROTOCOL_REGEX = /^node:/;
const require = createRequire(import.meta.url);

const nodePolyfillFallback = {
  buffer: require.resolve('buffer/'),
  process: require.resolve('process/browser.js'),
  stream: require.resolve('stream-browserify'),
  util: require.resolve('util/'),
  zlib: require.resolve('browserify-zlib'),
} satisfies NonNullable<Configuration['resolve']>['fallback'];

export const configureNodePolyfills = (baseConfig: Configuration) => {
  // This is added as a way to avoid issues caused by Next.js 13.4.3
  // introduced by gzip-size
  // Newer Next.js releases import builtins through the node: scheme, but webpack's
  // polyfill and fallback handling only applies once the request is normalized.
  baseConfig.plugins = [
    ...(baseConfig.plugins || []),
    new webpack.NormalModuleReplacementPlugin(NODE_PROTOCOL_REGEX, (resource) => {
      resource.request = resource.request.replace(NODE_PROTOCOL_REGEX, '');
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser.js',
    }),
  ];

  baseConfig.resolve = {
    ...baseConfig.resolve,
    fallback: {
      ...baseConfig.resolve?.fallback,
      ...nodePolyfillFallback,
      assert: false,
      crypto: false,
      fs: false,
    },
  };

  return baseConfig;
};
