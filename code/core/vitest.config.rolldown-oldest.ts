import { defineConfig, mergeConfig } from 'vitest/config';

import coreConfig from './vitest.config.ts';

// Runs the tests of the code that calls Rolldown on the oldest Rolldown that the range in
// package.json allows; the `core` project runs them on the version in the lockfile.
export default mergeConfig(
  coreConfig,
  defineConfig({
    resolve: { alias: [{ find: /^rolldown(?=$|\/)/, replacement: 'rolldown-oldest' }] },
    test: {
      name: 'core-rolldown-oldest',
      typecheck: { enabled: false },
      env: { ROLLDOWN_OLDEST: 'true' },
      include: [
        'src/bin/loader.test.ts',
        'src/builder-manager/**/*.test.ts',
        'src/common/utils/interpret-files.test.ts',
        'src/common/utils/rolldown-version.test.ts',
        'src/core-server/utils/build-or-throw.test.ts',
        'src/csf-tools/estree/*.test.ts',
        'src/manager/globals/*.test.ts',
        'src/mocking-utils/*.test.ts',
        'src/oxc-parser/*.test.ts',
        'src/shared/open-service/services/module-graph/**/*.test.ts',
      ],
    },
  })
);
