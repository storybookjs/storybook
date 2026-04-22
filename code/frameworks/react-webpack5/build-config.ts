import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

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
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
        dts: false,
      },
      {
        exportEntries: ['./preset-cra'],
        entryPoint: './src/preset-cra.ts',
        dts: false,
      },
      {
        exportEntries: ['./preset-react-docs'],
        entryPoint: './src/preset-react-docs.ts',
        dts: false,
      },
      {
        exportEntries: ['./react-docgen-loader'],
        entryPoint: './src/loaders/react-docgen-loader.ts',
        dts: false,
      },
      {
        exportEntries: ['./node'],
        entryPoint: './src/node/index.ts',
      },
    ],
  },
};

export default config;
