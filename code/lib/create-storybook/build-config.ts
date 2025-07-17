import { join } from 'node:path';

import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    node: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
        dts: false,
      },
      {
        entryPoint: './src/bin/index.ts',
        dts: false,
      },
    ],
  },
  postbuild: async (cwd) => {
    const { chmod } = await import('node:fs/promises');
    await chmod(join(cwd, 'dist', 'bin', 'index.js'), 0o755);
  },
};

export default config;
