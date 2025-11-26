import type { BuildEntries } from '../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    browser: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./react'],
        entryPoint: './src/react/index.ts',
      },
      {
        exportEntries: ['./preview'],
        entryPoint: './src/preview.ts',
      },
      {
        exportEntries: ['./manager'],
        entryPoint: './src/manager.ts',
        dts: false,
      },
    ],
  },
};

export default config;
