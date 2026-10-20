import { join } from 'pathe';

import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    node: [
      {
        entryPoint: './src/bin/index.ts',
        dts: false,
      },
    ],
  },
};

export default config;
