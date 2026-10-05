import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.shared.ts';

// The provider imports the navigation mock via the package name (singleton),
// which resolves to dist under vitest. Alias it to the source so the mock
// module instance is shared with the test's relative-source import.
export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    resolve: {
      alias: {
        '@storybook/nextjs-vite/navigation.mock': new URL(
          './src/export-mocks/navigation/index.ts',
          import.meta.url
        ).pathname,
      },
    },
  })
);
