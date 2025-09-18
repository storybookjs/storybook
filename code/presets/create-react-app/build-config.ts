import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    node: [
      {
        exportEntries: ['./index'],
        entryPoint: './src/index.ts',
        dts: false,
      },
    ],
  },
};

export default config;
