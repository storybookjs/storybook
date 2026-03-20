import { coverageConfigDefaults, defineConfig } from 'vitest/config';

/**
 * CircleCI reports the wrong number of threads to Node.js, so we need to set it manually. Unit
 * tests are running with the xlarge resource class, which has 8 vCPUs.
 *
 * @see https://jahed.dev/2022/11/20/fixing-node-js-multi-threading-on-circleci/
 * @see https://vitest.dev/config/maxworkers.html#maxworkers
 * @see https://circleci.com/docs/configuration-reference/#x86
 * @see .circleci/config.yml#L187
 */
const threadCount = process.env.CI ? (process.platform === 'win32' ? 4 : 7) : undefined;
const shouldRunStorybookTests = !(process.env.CI && process.platform === 'win32');

const projects = [
  'code/addons/*/vitest.config.ts',
  'code/frameworks/*/vitest.config.ts',
  'code/lib/*/vitest.config.ts',
  'code/core/vitest.config.ts',
  'code/builders/*/vitest.config.ts',
  'code/presets/*/vitest.config.ts',
  'code/renderers/*/vitest.config.ts',
  'scripts/vitest.config.ts',
];

/**
 * On CI, we run our own unit tests, but for performance reasons, we don't install playwright, thus
 * these tests, that need browser-mode cannot be run/added
 */
if (shouldRunStorybookTests) {
  projects.push('code/vitest.config.storybook.ts');
}

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
    },

    pool: 'threads',
    maxWorkers: threadCount,
    projects,

    coverage: {
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
