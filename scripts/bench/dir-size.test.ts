import { beforeEach, expect, it, vi } from 'vitest';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import { getDirSize } from './dir-size.ts';

vi.mock('node:fs/promises', { spy: true });

beforeEach(async () => {
  vol.reset();
  const fsp = await import('node:fs/promises');
  vi.mocked(fsp.readdir).mockImplementation(memfs.fs.promises.readdir as never);
  vi.mocked(fsp.stat).mockImplementation(memfs.fs.promises.stat as never);
});

it('counts a hard-linked file once, like the esbuild binary npm links into esbuild/bin', async () => {
  vol.fromJSON({
    '/bench/node_modules/@esbuild/linux-x64/bin/esbuild': 'x'.repeat(1000),
    '/bench/node_modules/esbuild/package.json': '{}',
  });
  memfs.fs.mkdirSync('/bench/node_modules/esbuild/bin');
  memfs.fs.linkSync(
    '/bench/node_modules/@esbuild/linux-x64/bin/esbuild',
    '/bench/node_modules/esbuild/bin/esbuild'
  );

  expect(await getDirSize('/bench/node_modules')).toBe(1002);
});
