import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    reporters: ['default', '@storybook/experimental-addon-vitest/reporter'],
    coverage: {
      all: false,
      provider: 'istanbul',
      exclude: [
        ...coverageConfigDefaults.exclude,
        '**/__mocks/**',
        '**/dist/**',
        'playwright.config.ts',
        'vitest-setup.ts',
        'vitest.helpers.ts',
      ],
    },
  },
});
