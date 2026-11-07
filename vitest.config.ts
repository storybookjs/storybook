import { coverageConfigDefaults, defineConfig } from 'vitest/config';

/**
 * CircleCI reports the wrong number of threads to Node.js, so we need to set it manually. Unit
 * tests run on the Linux xlarge and the Windows large resource classes, which both have 8 vCPUs.
 *
 * @see https://jahed.dev/2022/11/20/fixing-node-js-multi-threading-on-circleci/
 * @see https://vitest.dev/config/maxworkers.html#maxworkers
 * @see https://circleci.com/docs/configuration-reference/#x86
 * @see .circleci/config.yml#L187
 */
const threadCount = process.env.CI ? (process.platform === 'win32' ? 8 : 7) : undefined;
const isWindowsCI = Boolean(process.env.CI) && process.platform === 'win32';
const shouldRunStorybookTests = !isWindowsCI;

const projects = [
  // CircleCI's Windows jobs skip agent-eval, whose native dependencies they do not build; the NX
  // agents run the same `code:test-1`/`-2` targets on Windows as on Linux.
  ...(isWindowsCI ? [] : ['agent-eval/vitest.config.ts']),
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
  projects.push('code/vitest.config.ts');
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
