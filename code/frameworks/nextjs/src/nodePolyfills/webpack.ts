import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';
import type { Configuration } from 'webpack';
import webpack from 'webpack';

const NODE_PROTOCOL_REGEX = /^node:/;

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
    new NodePolyfillPlugin(),
  ];

  baseConfig.resolve = {
    ...baseConfig.resolve,
    fallback: {
      ...baseConfig.resolve?.fallback,
      fs: false,
    },
  };

  return baseConfig;
};
