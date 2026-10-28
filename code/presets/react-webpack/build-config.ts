import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    node: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./node'],
        entryPoint: './src/node.ts',
      },
      {
        exportEntries: ['./react-docgen-loader'],
        entryPoint: './src/loaders/react-docgen-loader.ts',
        dts: false,
      },
    ],
  },
};

export default config;
