import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    browser: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./client'],
        entryPoint: './src/client/index.ts',
      },
      {
        exportEntries: ['./client/config'],
        entryPoint: './src/client/config.ts',
      },
      {
        exportEntries: ['./client/docs/config'],
        entryPoint: './src/client/docs/config.ts',
      },
    ],
    node: [
      {
        exportEntries: ['./node'],
        entryPoint: './src/node/index.ts',
      },
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
      },
    ],
  },
};

export default config;
