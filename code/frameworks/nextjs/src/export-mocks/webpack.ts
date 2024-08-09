import { dirname, join } from 'path';
import type { Configuration as WebpackConfig } from 'webpack';

import { getCompatibilityAliases } from '../compatibility/compatibility-map';

const mapping = {
  'next/headers': '/dist/export-mocks/headers/index',
  '@storybook/nextjs/headers.mock': '/dist/export-mocks/headers/index',
  'next/navigation': '/dist/export-mocks/navigation/index',
  '@storybook/nextjs/navigation.mock': '/dist/export-mocks/navigation/index',
  'next/router': '/dist/export-mocks/router/index',
  '@storybook/nextjs/router.mock': '/dist/export-mocks/router/index',
  'next/cache': '/dist/export-mocks/cache/index',
  '@storybook/nextjs/cache.mock': '/dist/export-mocks/cache/index',
  ...getCompatibilityAliases(),
};

// Utility that assists in adding aliases to the Webpack configuration
// and also doubles as alias solution for portable stories in Jest/Vitest/etc.
export const getPackageAliases = ({ useESM = false }: { useESM?: boolean } = {}) => {
  const extension = useESM ? 'mjs' : 'js';
  const packageLocation = dirname(require.resolve('@storybook/nextjs/package.json'));

  const getFullPath = (path: string) =>
    join(packageLocation, path.replace('@storybook/nextjs', ''));

  const aliases = Object.fromEntries(
    Object.entries(mapping).map(([originalPath, aliasedPath]) => [
      originalPath,
      // Use paths for both next/xyz and @storybook/nextjs/xyz imports
      // to make sure they all serve the MJS/CJS version of the file
      getFullPath(`${aliasedPath}.${extension}`),
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
