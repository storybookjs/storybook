import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.shared.ts';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    test: {
      name: 'angular-cm-native-typescript',
      env: { STORYBOOK_DOCGEN_TS_API: 'native' },
    },
  })
);
