import { join } from 'node:path';

import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

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
