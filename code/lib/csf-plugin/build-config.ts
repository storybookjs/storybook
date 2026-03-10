import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    node: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./webpack-loader'],
        entryPoint: './src/webpack-loader.ts',
        dts: false,
      },
    ],
  },
};

export default config;
