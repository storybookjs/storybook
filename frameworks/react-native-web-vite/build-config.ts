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
        exportEntries: ['./node'],
        entryPoint: './src/node/index.ts',
      },
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
        dts: false,
      },
      {
        exportEntries: ['./vite-plugin'],
        entryPoint: './src/vite-plugin.ts',
        dts: false,
      },
    ],
  },
};

export default config;
