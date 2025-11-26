import type { BuildEntries } from '../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    browser: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./manager'],
        entryPoint: './src/manager.ts',
        dts: false,
      },
      {
        exportEntries: ['./preview'],
        entryPoint: './src/preview.ts',
      },
    ],
  },
};

export default config;
