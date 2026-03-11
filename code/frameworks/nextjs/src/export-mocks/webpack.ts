import type { Configuration as WebpackConfig } from 'webpack';

import { getCompatibilityAliases } from '../compatibility/compatibility-map';

const mapping = {
  'next/headers': '@storybook/nextjs/headers.mock',
  'next/navigation': '@storybook/nextjs/navigation.mock',
  'next/router': '@storybook/nextjs/router.mock',
  'next/cache': '@storybook/nextjs/cache.mock',
  'next/link': '@storybook/nextjs/link.mock',
  ...getCompatibilityAliases(),
};

// Utility that assists in adding aliases to the Webpack configuration
// and also doubles as alias solution for portable stories in Jest/Vitest/etc.
export const getPackageAliases = () => {
  return mapping;
};

export const configureNextExportMocks = (baseConfig: WebpackConfig): void => {
  const resolve = baseConfig.resolve ?? {};

  resolve.alias = {
    ...resolve.alias,
    ...mapping,
  };
};
