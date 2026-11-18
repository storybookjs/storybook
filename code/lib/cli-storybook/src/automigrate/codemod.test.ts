import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, expect, it, vi } from 'vitest';

import { join } from 'pathe';

import { runCodemod } from './codemod.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

let root: string;

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

it('reads a list of files as paths, not as globs', async () => {
  root = mkdtempSync(join(tmpdir(), 'storybook-run-codemod-'));
  const file = join(root, '(app)', '[id]', 'main.ts');
  mkdirSync(join(root, '(app)', '[id]'), { recursive: true });
  writeFileSync(file, 'export default {};');

  const { errorCount } = await runCodemod([file], (info) => `${info.source}\n// migrated`, {
    skipFormatting: true,
  });

  expect(errorCount).toBe(0);
  expect(readFileSync(file, 'utf-8')).toBe('export default {};\n// migrated');
});

it('skips what is inside a directory named like a story file', async () => {
  root = mkdtempSync(join(tmpdir(), 'storybook-run-codemod-'));
  mkdirSync(join(root, '__screenshots__', 'Button.stories.tsx'), { recursive: true });
  writeFileSync(join(root, '__screenshots__', 'Button.stories.tsx', 'Primary.png'), 'png');
  writeFileSync(join(root, 'Button.stories.tsx'), 'export default {};');

  const { files } = await runCodemod(`${root}/**/*.stories.tsx`, (info) => info.source, {
    dryRun: true,
  });

  expect(files).toEqual([join(root, 'Button.stories.tsx')]);
});

it('reads a directory as all files in it', async () => {
  root = mkdtempSync(join(tmpdir(), 'storybook-run-codemod-'));
  mkdirSync(join(root, 'src', 'nested'), { recursive: true });
  writeFileSync(join(root, 'src', 'nested', 'Button.stories.tsx'), 'export default {};');

  const { files } = await runCodemod(join(root, 'src'), (info) => info.source, { dryRun: true });

  expect(files).toEqual([join(root, 'src', 'nested', 'Button.stories.tsx')]);
});

it('rejects a range, which it cannot expand', async () => {
  root = mkdtempSync(join(tmpdir(), 'storybook-run-codemod-'));

  await expect(
    runCodemod(`${root}/story{1..9}.stories.js`, (info) => info.source, { dryRun: true })
  ).rejects.toThrow('Unsupported glob pattern');
});

it('finds and ignores files above the current directory', async () => {
  root = mkdtempSync(join(tmpdir(), 'storybook-run-codemod-'));
  for (const dir of ['packages/a/src', 'packages/b', 'packages/b/node_modules/pkg']) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  writeFileSync(join(root, 'packages/a/src/A.stories.tsx'), 'export default {};');
  writeFileSync(join(root, 'packages/b/B.stories.tsx'), 'export default {};');
  writeFileSync(join(root, 'packages/b/node_modules/pkg/C.stories.tsx'), 'export default {};');
  vi.spyOn(process, 'cwd').mockReturnValue(join(root, 'packages/a'));
  const expected = [
    join(root, 'packages/a/src/A.stories.tsx'),
    join(root, 'packages/b/B.stories.tsx'),
  ];

  for (const pattern of ['../**/*.stories.tsx', `${root}/**/*.stories.tsx`, '..']) {
    const { files } = await runCodemod(pattern, (info) => info.source, { dryRun: true });
    expect(files.sort()).toEqual(expected);
  }
});
