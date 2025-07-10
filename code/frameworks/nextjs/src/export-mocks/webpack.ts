import type { Configuration as WebpackConfig } from 'webpack';

import { getCompatibilityAliases } from '../compatibility/compatibility-map';

const mapping = {
  'next/headers': import.meta.resolve('@storybook/nextjs/headers.mock'),
  'next/navigation': import.meta.resolve('@storybook/nextjs/navigation.mock'),
  'next/router': import.meta.resolve('@storybook/nextjs/router.mock'),
  'next/cache': import.meta.resolve('@storybook/nextjs/cache.mock'),
  ...getCompatibilityAliases(),
};

// Utility that assists in adding aliases to the Webpack configuration
// and also doubles as alias solution for portable stories in Jest/Vitest/etc.
export const getPackageAliases = ({ useESM = false }: { useESM?: boolean } = {}) => {
  const aliases = Object.fromEntries(
    Object.entries(mapping).map(([originalPath, aliasedPath]) => [originalPath, aliasedPath])
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
