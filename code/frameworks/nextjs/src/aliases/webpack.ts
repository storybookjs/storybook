import type { Configuration as WebpackConfig } from 'webpack';

export const configureAliases = (baseConfig: WebpackConfig): void => {
  baseConfig.resolve = {
    ...(baseConfig.resolve ?? {}),
    alias: {
      ...(baseConfig.resolve?.alias ?? {}),
      '@opentelemetry/api': 'next/dist/compiled/@opentelemetry/api',
    },
  };
};
