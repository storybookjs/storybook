import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    node: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./child-host'],
        entryPoint: './src/child-host-entry.ts',
        dts: false,
      },
      {
        exportEntries: ['./internal'],
        entryPoint: './src/internal.ts',
      },
    ],
  },
};

export default config;
