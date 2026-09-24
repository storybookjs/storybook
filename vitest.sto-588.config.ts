import { defineConfig, mergeConfig } from 'vitest/config';

import coreConfig from './code/core/vitest.config.ts';

export default mergeConfig(
  coreConfig,
  defineConfig({
    test: {
      cache: false,
      include: [
        'code/core/src/test/index.test.ts',
        'code/core/src/test/index.instrumentation.test.ts',
        'code/core/src/test/dist-contract.test.ts',
        'code/renderers/react/src/dist-contract.test.ts',
      ],
      typecheck: {
        enabled: false,
      },
    },
  })
);
