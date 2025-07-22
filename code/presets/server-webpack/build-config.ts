import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    node: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./loader'],
        entryPoint: './src/loader.ts',
        dts: false,
      },
    ],
  },
};

export default config;
