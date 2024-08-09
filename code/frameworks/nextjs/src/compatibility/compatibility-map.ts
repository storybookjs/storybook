import semver from 'semver';
import type { Configuration as WebpackConfig } from 'webpack';

import { addScopedAlias, getNextjsVersion } from '../utils';

const mapping: Record<string, Record<string, string>> = {
  '<14.1.0': {
    // https://github.com/vercel/next.js/blob/v14.1.0/packages/next/src/shared/lib/segment.ts
    'next/dist/shared/lib/segment': '@storybook/nextjs/dist/compatibility/segment.compat',
  },
  '<14.0.4': {
    // https://github.com/vercel/next.js/blob/v14.0.4/packages/next/src/client/components/redirect-status-code.ts
    'next/dist/client/components/redirect-status-code':
      '@storybook/nextjs/dist/compatibility/redirect-status-code.compat',
  },
};

export const getCompatibilityAliases = () => {
  const version = getNextjsVersion();
  const result: Record<string, string> = {};

  Object.keys(mapping).forEach((key) => {
    if (semver.intersects(version, key)) {
      Object.assign(result, mapping[key]);
    }
  });

  return result;
};

export const configureCompatibilityAliases = (baseConfig: WebpackConfig): void => {
  const aliases = getCompatibilityAliases();

  Object.entries(aliases).forEach(([name, alias]) => {
    addScopedAlias(baseConfig, name, alias);
  });
};
