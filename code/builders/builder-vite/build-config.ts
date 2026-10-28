import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    node: [
      { exportEntries: ['./node'], entryPoint: './src/node/index.ts' },
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
    ],
  },
};

export default config;
