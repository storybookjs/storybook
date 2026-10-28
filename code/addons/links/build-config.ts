import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    node: [
      {
        exportEntries: ['./node'],
        entryPoint: './src/node.ts',
      },
    ],
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
