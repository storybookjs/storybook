import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../vitest.shared.ts';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    // oxc-parser / oxc-resolver ship `browser` entry points that import WASM bindings which
    // are not installed in this monorepo. Force Vite/Vitest to resolve them via their Node
    // entry points (index.js) during tests and benchmarks.
    resolve: {
      conditions: ['node'],
      mainFields: ['main'],
    },
    ssr: {
      external: ['oxc-parser', 'oxc-resolver'],
    },
    test: {
      name: 'core',
      typecheck: {
        enabled: true,
        ignoreSourceErrors: true,
      },
      server: {
        deps: {
          external: ['oxc-parser', 'oxc-resolver'],
        },
      },
      benchmark: {
        include: ['**/*.bench.ts'],
      },
    },
  })
);
