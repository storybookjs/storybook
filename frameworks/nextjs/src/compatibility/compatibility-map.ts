import semver from 'semver';
import type { Configuration as WebpackConfig } from 'webpack';

import { addScopedAlias, getNextjsVersion, setAlias } from '../utils';

const mapping: Record<string, Record<string, string | boolean>> = {
  '<14.1.0': {
    // https://github.com/vercel/next.js/blob/v14.1.0/packages/next/src/shared/lib/segment.ts
    'next/dist/shared/lib/segment': '@storybook/nextjs/dist/compatibility/segment.compat',
  },
  '<14.0.4': {
    // https://github.com/vercel/next.js/blob/v14.0.4/packages/next/src/client/components/redirect-status-code.ts
    'next/dist/client/components/redirect-status-code':
      '@storybook/nextjs/dist/compatibility/redirect-status-code.compat',
  },
  '<15.0.0': {
    'next/dist/server/request/headers': 'next/dist/client/components/headers',
    // this path only exists from Next 15 onwards
    'next/dist/server/request/draft-mode': '@storybook/nextjs/dist/compatibility/draft-mode.compat',
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
    if (typeof alias === 'string') {
      addScopedAlias(baseConfig, name, alias);
    } else {
      setAlias(baseConfig, name, alias);
    }
  });
};
