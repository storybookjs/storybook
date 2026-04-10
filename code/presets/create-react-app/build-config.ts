import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    node: [
      {
        exportEntries: ['./index', './preset'],
        entryPoint: './src/index.ts',
        dts: false,
      },
    ],
  },
};

export default config;
