import path from 'node:path';

import { x as exec } from 'tinyexec';

import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  // tsgo declaration emit is pathologically slow on this package (minutes to
  // hours, likely choking on @typescript-eslint's recursive types); the tsc
  // emitter finishes in seconds.
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
