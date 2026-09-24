import * as fs from 'node:fs/promises';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import { analyzeReactDomShimWorkspace } from './react-dom-shim-workspace.ts';

vi.mock('node:fs/promises', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(fs.readFile).mockImplementation(vol.promises.readFile as typeof fs.readFile);
  vi.mocked(fs.readdir).mockImplementation(vol.promises.readdir as typeof fs.readdir);
});

afterEach(() => vi.restoreAllMocks());

it('names the config package manifest when traversal cannot enter its directory', async () => {
  vol.fromNestedJSON({
    '/project/package.json': `${JSON.stringify({ private: true, workspaces: ['apps/*'] })}\n`,
    '/project/apps/web/package.json': `${JSON.stringify({
      private: true,
      dependencies: { '@storybook/react-dom-shim': '10.5.10' },
    })}\n`,
  });
  vi.mocked(fs.readdir).mockImplementation(async (path, options) => {
    if (path === '/project/apps/web') throw new Error('permission denied');
    return vol.promises.readdir(path, options) as ReturnType<typeof fs.readdir>;
  });

  await expect(analyzeReactDomShimWorkspace('/project/apps/web')).resolves.toMatchObject({
    kind: 'manual',
    diagnostics: [
      '/project/apps/web/package.json: declares @storybook/react-dom-shim and requires manual migration',
      '/project: scan was incomplete',
    ],
  });
});
