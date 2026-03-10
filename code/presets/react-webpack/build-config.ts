import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    node: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./preset-cra'],
        entryPoint: './src/framework-preset-cra.ts',
        dts: false,
      },
      {
        exportEntries: ['./preset-react-docs'],
        entryPoint: './src/framework-preset-react-docs.ts',
        dts: false,
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
