import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    node: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
        dts: false,
      },
      {
        entryPoint: './src/bin/index.ts',
        dts: false,
      },
    ],
  },
};

export default config;
