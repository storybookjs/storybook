import { defineConfig } from 'vitest/config';

/**
 * CircleCI reports the wrong number of threads to Node.js, so we need to set it manually. Script
 * tests are running with the small resource class, which has 1 vCPU.
 *
 * @see https://jahed.dev/2022/11/20/fixing-node-js-multi-threading-on-circleci/
 * @see https://vitest.dev/config/maxworkers.html#maxworkers
 * @see https://circleci.com/docs/configuration-reference/#x86
 * @see .circleci/config.yml#L187
 */
const threadCount = process.env.CI ? 1 : undefined;

export default defineConfig({
  test: {
    name: 'scripts',
    clearMocks: true,
    setupFiles: process.env.STORYBOOK_OS_PROBE_DIR ? ['./ci/os-probe/probe.ts'] : [],
    // Not 'threads': ending a worker thread unloads the native addons it loaded, such as rolldown,
    // while their Tokio threads can still run, which crashes Node on Windows.
    pool: 'forks',
    maxWorkers: threadCount,
  },
});
