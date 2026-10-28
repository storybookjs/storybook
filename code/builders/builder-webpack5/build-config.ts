import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    node: [
      { exportEntries: ['./node'], entryPoint: './src/node/index.ts' },
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./loaders/export-order-loader'],
        entryPoint: './src/loaders/export-order-loader.ts',
        dts: false,
      },
      {
        exportEntries: ['./loaders/storybook-mock-transform-loader'],
        entryPoint: './src/loaders/storybook-mock-transform-loader.ts',
        dts: false,
      },
      {
        exportEntries: ['./loaders/webpack-automock-loader'],
        entryPoint: './src/loaders/webpack-automock-loader.ts',
        dts: false,
      },
    ],
  },
};

export default config;
