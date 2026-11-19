import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.shared.ts';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    root: import.meta.dirname,
    test: {
      name: 'docgen-harness-native-typescript',
      include: ['src/angular/angular-component-meta-baselines.test.ts'],
      env: { STORYBOOK_DOCGEN_TS_API: 'native' },
    },
  })
);
