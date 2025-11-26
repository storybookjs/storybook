import type { BuildEntries } from '../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    node: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
        dts: false,
      },
    ],
  },
  extraOutputs: {
    './input/iframe.html': './input/iframe.html',
  },
};

export default config;
