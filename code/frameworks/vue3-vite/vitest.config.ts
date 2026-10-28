import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.shared.ts';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    test: {
      server: {
        deps: {
          // `vue-component-meta.test.ts` mocks the modules the built renderer node entry imports.
          inline: [/\/code\/renderers\/vue3\/dist\/node\.js$/],
        },
      },
    },
  })
);
