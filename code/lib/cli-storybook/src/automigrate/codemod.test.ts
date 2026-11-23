import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, expect, it, vi } from 'vitest';

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
