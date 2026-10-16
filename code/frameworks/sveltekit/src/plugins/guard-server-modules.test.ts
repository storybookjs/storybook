import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { build } from 'vite';
import { describe, expect, it } from 'vitest';

import { guardServerModules } from './guard-server-modules.ts';

async function writeFiles(root: string, files: Record<string, string>) {
  for (const [file, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), content);
  }
}

// `$app` and `$env` point into `kitDir`, like the aliases of the SvelteKit plugin
async function buildClient(kitDir: string, entry: string) {
  const root = await mkdtemp(join(tmpdir(), 'sveltekit-guard-'));
  const runtime = join(root, kitDir, 'src/runtime');
  await writeFiles(root, {
    'entry.js': entry,
    [`${kitDir}/src/runtime/app/server/index.js`]: `export const read = () => 'server';`,
    [`${kitDir}/src/runtime/app/env/private/index.js`]: `export const SECRET = 'private-value';`,
    [`${kitDir}/src/runtime/env/static/private.js`]: `export * from '../../app/env/private/index.js';`,
  });

  return build({
    root,
    configFile: false,
    logLevel: 'silent',
    resolve: {
      alias: [
        { find: '$app', replacement: `${runtime}/app` },
        { find: '$env', replacement: `${runtime}/env` },
      ],
    },
    build: { write: false, rollupOptions: { input: join(root, 'entry.js') } },
    plugins: [guardServerModules()],
  });
}

describe('guardServerModules', () => {
  // A Kit checkout linked into the project (`link:`, `portal:`, `pnpm link`) resolves to its real path
  describe.each(['node_modules/@sveltejs/kit', 'kit/packages/kit'])('with Kit at %s', (kitDir) => {
    it.each([
      `import { SECRET } from '$app/env/private'; console.log(SECRET);`,
      `import { SECRET } from '$env/static/private'; console.log(SECRET);`,
      `import { read } from '$app/server'; console.log(read);`,
    ])('fails to build %s for the browser', async (entry) => {
      await expect(buildClient(kitDir, entry)).rejects.toThrow('server-only modules');
    });
  });
});
