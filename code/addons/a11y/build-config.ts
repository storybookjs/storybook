import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    browser: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./preview'],
        entryPoint: './src/preview.tsx',
      },
      {
        exportEntries: ['./manager'],
        entryPoint: './src/manager.tsx',
        dts: false,
      },
    ],
    node: [
      {
        exportEntries: ['./postinstall'],
        entryPoint: './src/postinstall.ts',
        dts: false,
      },
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
        dts: false,
      },
    ],
  },
};

export default config;
