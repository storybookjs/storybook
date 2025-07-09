import { dirname, join } from 'node:path';

import type { Configuration as WebpackConfig } from 'webpack';

import { getCompatibilityAliases } from '../compatibility/compatibility-map';

const mapping = {
  'next/headers': '/dist/export-mocks/headers/index',
  '@storybook/experimental-nextjs-rsc/headers.mock': '/dist/export-mocks/headers/index',
  'next/router': '/dist/export-mocks/router/index',
  '@storybook/experimental-nextjs-rsc/router.mock': '/dist/export-mocks/router/index',
  'next/cache': '/dist/export-mocks/cache/index',
  '@storybook/experimental-nextjs-rsc/cache.mock': '/dist/export-mocks/cache/index',
  ...getCompatibilityAliases(),
};

// Utility that assists in adding aliases to the Webpack configuration
// and also doubles as alias solution for portable stories in Jest/Vitest/etc.
export const getPackageAliases = ({ useESM = false }: { useESM?: boolean } = {}) => {
  const extension = useESM ? 'mjs' : 'js';
  const packageLocation = dirname(
    require.resolve('@storybook/experimental-nextjs-rsc/package.json')
  );

  const getFullPath = (path: string) =>
    path.startsWith('next')
      ? path
      : join(packageLocation, path.replace('@storybook/experimental-nextjs-rsc', ''));

  const aliases = Object.fromEntries(
    Object.entries(mapping).map(([originalPath, aliasedPath]) => [
      originalPath,
      // Use paths for both next/xyz and @storybook/experimental-nextjs-rsc/xyz imports
      // to make sure they all serve the MJS/CJS version of the file
      typeof aliasedPath === 'string' ? getFullPath(`${aliasedPath}.${extension}`) : aliasedPath,
    ])
  );

  return aliases;
};

export const configureNextExportMocks = (baseConfig: WebpackConfig): void => {
  const resolve = baseConfig.resolve ?? {};

  resolve.alias = {
    ...resolve.alias,
    ...getPackageAliases({ useESM: true }),
  };
};
