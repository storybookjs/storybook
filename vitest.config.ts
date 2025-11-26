import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
    },

    projects: [
      'vitest-storybook.config.ts',
      'addons/*/vitest.config.ts',
      'frameworks/*/vitest.config.ts',
      'lib/*/vitest.config.ts',
      'core/vitest.config.ts',
      'builders/*/vitest.config.ts',
      'presets/*/vitest.config.ts',
      'renderers/*/vitest.config.ts',
    ],

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
        '**/*.stories.*',
      ],
    },
  },
});
