import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    node: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./transforms/csf-2-to-3'],
        entryPoint: './src/transforms/csf-2-to-3.ts',
        dts: false,
      },
      {
        exportEntries: ['./transforms/find-implicit-spies'],
        entryPoint: './src/transforms/find-implicit-spies.ts',
        dts: false,
      },
      {
        exportEntries: ['./transforms/upgrade-deprecated-types'],
        entryPoint: './src/transforms/upgrade-deprecated-types.ts',
        dts: false,
      },
      {
        exportEntries: ['./transforms/upgrade-hierarchy-separators'],
        entryPoint: './src/transforms/upgrade-hierarchy-separators.js',
        dts: false,
      },
    ],
  },
};

export default config;
