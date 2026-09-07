import path from 'node:path';

import { x as exec } from 'tinyexec';

import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  // The TS 7 native emitter orders properties of the huge inferred object
  // types in `configs` non-deterministically across runs (byte-flapping
  // d.ts); the TS 6 emitter is stable and fast enough for this package.
  dtsBundler: 'rolldown',
  prebuild: async (cwd) => {
    await exec('jiti', [path.join(import.meta.dirname, 'scripts', 'update-all.ts')], {
      nodeOptions: {
        cwd,
        env: {
          ...process.env,
          FORCE_COLOR: '1',
        },
        stdio: 'inherit',
      },
      throwOnError: true,
    });
  },
  entries: {
    node: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
    ],
  },
};

export default config;
