import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'ecosystem-qa',
    include: ['lib/**/*.test.ts'],
    setupFiles: process.env.STORYBOOK_OS_PROBE_DIR ? ['../scripts/ci/os-probe/probe.ts'] : [],
  },
});
