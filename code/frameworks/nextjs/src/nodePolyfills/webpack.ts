import { createRequire } from 'node:module';
import type { Configuration } from 'webpack';
import webpack from 'webpack';

const NODE_PROTOCOL_REGEX = /^node:/;
const require = createRequire(import.meta.url);

const nodePolyfillFallback = {
  buffer: require.resolve('buffer/'),
  events: require.resolve('events/'),
  process: require.resolve('process/browser.js'),
  stream: require.resolve('stream-browserify'),
  util: require.resolve('util/'),
  zlib: require.resolve('browserify-zlib'),
} satisfies NonNullable<Configuration['resolve']>['fallback'];

export const configureNodePolyfills = (baseConfig: Configuration) => {
  // Next.js internals that reach the preview bundle (gzip-size) import `stream` and `zlib`;
  // the remaining fallbacks are what those two polyfills require.
  // Newer Next.js releases import builtins through the node: scheme, but webpack's
  // polyfill and fallback handling only applies once the request is normalized.
  baseConfig.plugins = [
    ...(baseConfig.plugins || []),
    new webpack.NormalModuleReplacementPlugin(NODE_PROTOCOL_REGEX, (resource) => {
      resource.request = resource.request.replace(NODE_PROTOCOL_REGEX, '');
    }),
    new webpack.ProvidePlugin({
      Buffer: [nodePolyfillFallback.buffer, 'Buffer'],
      process: nodePolyfillFallback.process,
    }),
  ];

  baseConfig.resolve = {
    ...baseConfig.resolve,
    fallback: {
      ...nodePolyfillFallback,
      fs: false,
      ...baseConfig.resolve?.fallback,
    },
  };

  return baseConfig;
};
