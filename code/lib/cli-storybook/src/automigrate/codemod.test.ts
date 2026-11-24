import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { stripVTControlCharacters } from 'node:util';
import { afterEach, expect, it, onTestFinished, vi } from 'vitest';

import { invalidateProjectRootCache } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

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

it.each([
  [true, 1],
  [false, 0],
])('says it was a dry run when announceDryRun is %s: %i time(s)', async (announceDryRun, times) => {
  root = mkdtempSync(join(tmpdir(), 'storybook-run-codemod-'));
  const file = join(root, 'main.ts');
  writeFileSync(file, 'export default {};');

  await runCodemod([file], (info) => `${info.source}\n// migrated`, {
    dryRun: true,
    announceDryRun,
  });

  const output = vi.mocked(logger.log).mock.calls.flat().join('\n');
  expect(output.match(/This was a dry run/g) ?? []).toHaveLength(times);
  expect(readFileSync(file, 'utf-8')).toBe('export default {};');
});

it('names each file a dry run would write, from the project root', async () => {
  root = mkdtempSync(join(tmpdir(), 'storybook-run-codemod-'));
  vi.stubEnv('STORYBOOK_PROJECT_ROOT', root);
  invalidateProjectRootCache();
  onTestFinished(() => {
    vi.unstubAllEnvs();
    invalidateProjectRootCache();
  });
  mkdirSync(join(root, 'src'));
  const changed = join(root, 'src/b.ts');
  writeFileSync(changed, 'export default {};');
  writeFileSync(join(root, 'a.ts'), 'unchanged');

  await runCodemod(
    [changed, join(root, 'a.ts')],
    (info) => (info.source === 'unchanged' ? info.source : `${info.source}\n// migrated`),
    { dryRun: true }
  );

  const output = stripVTControlCharacters(vi.mocked(logger.log).mock.calls.flat().join('\n'));
  expect(output).toContain('Would write to src/b.ts');
  expect(output).not.toContain('a.ts');
  expect(readFileSync(changed, 'utf8')).toBe('export default {};');
});

it('counts the files a dry run would transform', async () => {
  root = mkdtempSync(join(tmpdir(), 'storybook-run-codemod-'));
  const file = join(root, 'main.ts');
  writeFileSync(file, 'export default {};');

  await runCodemod([file], (info) => `${info.source}\n// migrated`, { dryRun: true });

  const output = stripVTControlCharacters(vi.mocked(logger.log).mock.calls.flat().join('\n'));
  expect(output).toContain('Summary: 1 to transform, 0 unmodified, 0 errors');
});
