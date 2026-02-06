import type { Configuration as WebpackConfig } from 'webpack';

export const configureRSC = (baseConfig: WebpackConfig): void => {
  const resolve = baseConfig.resolve ?? {};
  resolve.alias = {
    ...resolve.alias,
    'server-only$': require.resolve('./rsc/server-only.js'),
  };
};
