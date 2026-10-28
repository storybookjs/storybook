import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, it } from 'vitest';

import { copyRuntimes } from './copy-runtimes.ts';

async function setup(sourceFiles: string[]): Promise<{ cwd: string; codeDir: string }> {
  const root = await mkdtemp(join(tmpdir(), 'copy-runtimes-'));
  const codeDir = join(root, 'code');
  await mkdir(join(codeDir, 'src'), { recursive: true });
  for (const file of sourceFiles) {
    await mkdir(join(codeDir, 'src', file, '..'), { recursive: true });
    await writeFile(join(codeDir, 'src', file), 'export {};');
  }
  return { cwd: join(root, 'pkg'), codeDir };
}

it('copies the listed entries, including directories', async () => {
  const { cwd, codeDir } = await setup(['runtime.js', 'chunks/a.js', 'other.js']);

  await copyRuntimes(cwd, codeDir, [
    { from: 'src', to: 'dist/out', files: ['runtime.js', 'chunks'] },
  ]);

  expect((await readdir(join(cwd, 'dist/out'))).sort()).toMatchInlineSnapshot(`
    [
      "chunks",
      "runtime.js",
    ]
  `);
});

it('fails when a listed runtime is missing from the owning package', async () => {
  const { cwd, codeDir } = await setup(['other.js']);

  await expect(
    copyRuntimes(cwd, codeDir, [{ from: 'src', to: 'dist/out', files: ['runtime.js'] }])
  ).rejects.toThrow(/Runtime "runtime\.js" is missing/);
});
