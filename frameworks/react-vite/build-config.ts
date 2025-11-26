import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    browser: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
    ],
    node: [
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
      },
      {
        exportEntries: ['./node'],
        entryPoint: './src/node/index.ts',
      },
    ],
  },
};

export default config;
