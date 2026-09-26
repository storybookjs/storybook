import { resolve } from 'node:path';

import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../code/vitest.shared.ts';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    root: resolve(import.meta.dirname, '../../code/addons/vitest'),
    test: {
      passWithNoTests: false,
      include: [
        'src/node/test-manager.test.ts',
        'src/node/coverage-reporter.test.ts',
        'src/vitest-plugin/vitest-root.test.ts',
      ],
    },
  })
);
