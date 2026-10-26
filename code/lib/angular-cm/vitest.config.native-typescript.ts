import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.shared.ts';

// The analyzer and manager tests once more, on the native API of TypeScript 7.1 (the
// `typescript-native` alias). The test helpers read the environment variable.
export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    test: {
      name: 'angular-cm-native-typescript',
      env: { STORYBOOK_DOCGEN_TS_API: 'native' },
    },
  })
);
