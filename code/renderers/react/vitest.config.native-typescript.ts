import { defineConfig, mergeConfig } from 'vitest/config';

import { vitestCommonConfig } from '../../vitest.shared.ts';

// The component-meta docgen tests once more, on the native API of TypeScript 7.1 (the
// `typescript-native` alias). The test helpers read the environment variable and build the manager
// and the shared project on that API.
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
