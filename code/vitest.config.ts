import { coverageConfigDefaults, defineConfig } from 'vitest/config';

/**
 * CircleCI reports the wrong number of threads to Node.js, so we need to set it manually. Unit
 * tests are running with the xlarge resource class, which has 8 vCPUs.
 *
 * @see https://jahed.dev/2022/11/20/fixing-node-js-multi-threading-on-circleci/
 * @see https://vitest.dev/config/#pooloptions-threads-maxthreads
 * @see https://circleci.com/docs/configuration-reference/#x86
 * @see .circleci/config.yml#L214
 */
const threadCount = process.env.CI ? (process.platform === 'win32' ? 4 : 7) : undefined;

export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: threadCount,
      },
    },
    passWithNoTests: true,
    clearMocks: true,
    setupFiles: ['./vitest-setup.ts'],
    // Disable globals due to https://github.com/testing-library/user-event/pull/1176 not being released yet
    globals: false,
    testTimeout: 10000,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
    },

    projects: [
      'vitest.config.storybook.mts',
      'addons/*/vitest.config.ts',
      'frameworks/*/vitest.config.ts',
      'lib/*/vitest.config.ts',
      'core/vitest.config.ts',
      'builders/*/vitest.config.ts',
      'presets/*/vitest.config.ts',
      'renderers/*/vitest.config.ts',
    ],

    coverage: {
      provider: 'v8',
      include: [
        'addons/**',
        'builders/**',
        'core/**',
        'frameworks/**',
        'lib/**',
        'presets/**',
        'renderers/**',
      ],
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
