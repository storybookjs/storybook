import { fileURLToPath } from 'node:url';

import type { Configuration as WebpackConfig } from 'webpack';

export const configureRSC = (baseConfig: WebpackConfig): void => {
  const resolve = baseConfig.resolve ?? {};
  resolve.alias = {
    ...resolve.alias,
    'server-only$': fileURLToPath(import.meta.resolve('./rsc/server-only.js')),
  };
};
