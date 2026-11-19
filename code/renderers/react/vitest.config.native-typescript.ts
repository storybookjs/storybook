import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.shared.ts';

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    test: {
      name: 'react-native-typescript',
      setupFiles: ['./vitest.setup.ts'],
      include: [
        'src/componentManifest/componentMeta/**/*.test.ts',
        'src/docgen/buildDocgen.test.ts',
      ],
      env: { STORYBOOK_DOCGEN_TS_API: 'native' },
    },
  })
);
