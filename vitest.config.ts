import { readFileSync } from 'node:fs';

import { coverageConfigDefaults, defineConfig } from 'vitest/config';

/**
 * Returns the CPUs the container may use, from its cgroup CPU quota, or `undefined` when there is
 * no quota. Docker executors report the host's CPU count to Node.js, not the container's.
 *
 * @see https://jahed.dev/2022/11/20/fixing-node-js-multi-threading-on-circleci/
 */
function getCgroupCpuLimit(): number | undefined {
  const read = (path: string) => {
    try {
      return readFileSync(path, 'utf8').trim();
    } catch {
      return undefined;
    }
  };

  // cgroup v2: "<quota> <period>", or "max <period>" without a limit.
  const [quotaV2, periodV2] = read('/sys/fs/cgroup/cpu.max')?.split(' ') ?? [];
  // cgroup v1: a quota of -1 means no limit.
  const quota = Number(quotaV2 ?? read('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'));
  const period = Number(periodV2 ?? read('/sys/fs/cgroup/cpu/cpu.cfs_period_us'));

  return quota > 0 && period > 0 ? Math.max(1, Math.floor(quota / period)) : undefined;
}

/**
 * On Linux, leave one CPU for the main process, which transforms modules for the workers, as
 * Vitest's default does. The Windows large resource class has 8 vCPUs and no cgroup to read.
 *
 * @see https://vitest.dev/config/maxworkers.html#maxworkers
 * @see https://circleci.com/docs/configuration-reference/#x86
 */
const getCiThreadCount = () => {
  if (process.platform === 'win32') {
    return 8;
  }
  const cpus = getCgroupCpuLimit();
  return cpus ? Math.max(1, cpus - 1) : 7;
};

const threadCount = process.env.CI ? getCiThreadCount() : undefined;
const shouldRunStorybookTests = !(process.env.CI && process.platform === 'win32');

const projects = [
  'agent-eval/vitest.config.ts',
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

    // Prints console output for failing tests only. Pass `--silent=false` to see every log.
    silent: 'passed-only',

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
