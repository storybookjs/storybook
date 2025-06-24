import { defineConfig } from 'vitest/config';

/**
 * CircleCI reports the wrong number of threads to Node.js, so we need to set it manually. Script
 * tests are running with the small resource class, which has 1 vCPU.
 *
 * @see https://jahed.dev/2022/11/20/fixing-node-js-multi-threading-on-circleci/
 * @see https://vitest.dev/config/#pooloptions-threads-maxthreads
 * @see https://circleci.com/docs/configuration-reference/#x86
 * @see .circleci/config.yml#L187
 */
const threadCount = process.env.CI ? 1 : undefined;

export default defineConfig({
  test: {
    clearMocks: true,
    poolOptions: {
      threads: {
        minThreads: threadCount,
        maxThreads: threadCount,
      },
    },
  },
});
