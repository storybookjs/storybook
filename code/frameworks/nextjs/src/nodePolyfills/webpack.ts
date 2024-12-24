import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';
import type { Configuration } from 'webpack';

export const configureNodePolyfills = (baseConfig: Configuration) => {
  // This is added as a way to avoid issues caused by Next.js 13.4.3
  // introduced by gzip-size
  baseConfig.plugins = [...(baseConfig.plugins || []), new NodePolyfillPlugin()];

  baseConfig.resolve = {
    ...baseConfig.resolve,
    fallback: {
      fs: false,
    },
  };

  return baseConfig;
};
