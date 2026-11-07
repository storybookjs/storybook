import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runOnFiles } from '../nx/affected.ts';
import {
  changedFilesEnvironment,
  changedFilesFromEnvironment,
  focusDiff,
} from './changed-files.ts';

// Over 1 MiB of paths: more than Linux allows in one environment variable or argument (128 KiB)
// and more than macOS allows for all of them together.
const FILES = Array.from(
  { length: 6000 },
  (_, i) => `code/${String(i).padStart(4, '0')}-${'x'.repeat(200)}.ts`
);

let directory: string;
let origin: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'changed-files-'));
  origin = join(directory, 'origin');
  mkdirSync(join(origin, 'code'), { recursive: true });
  git(origin, 'init', '--quiet', '--initial-branch=next');
  writeFileSync(join(origin, 'README.md'), 'base');
  git(origin, 'add', '.');
  git(origin, 'commit', '--quiet', '-m', 'base');
  git(origin, 'checkout', '--quiet', '-b', 'pr');
  FILES.forEach((file) => writeFileSync(join(origin, file), ''));
  git(origin, 'add', '.');
  git(origin, 'commit', '--quiet', '-m', 'a large change');
}, 60_000);

afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe('the changed files of a focused run', () => {
  it('reach a shallow checkout of any size of diff, through the commit it starts at', () => {
    const diff = focusDiff('next', origin);
    expect(diff.files).toEqual(FILES);

    const env = changedFilesEnvironment(diff);
    expect(Object.values(env).every((value) => value.length < 100)).toBe(true);

    // As the CircleCI jobs check out: one commit, without the one the diff starts at.
    const checkout = join(directory, 'checkout');
    execFileSync('git', [
      'clone',
      '--quiet',
      '--depth=1',
      '--branch=pr',
      `file://${origin}`,
      checkout,
    ]);
    expect(changedFilesFromEnvironment(env, checkout)).toEqual(FILES);
  });

  it('fail when the diff is not the one the run was planned from', () => {
    const { base } = focusDiff('next', origin);
    expect(() =>
      changedFilesFromEnvironment(
        { CI_CHANGED_FILES_BASE: base, CI_CHANGED_FILES_COUNT: '5' },
        origin
      )
    ).toThrow('6000 files changed');
  });

  it('are none outside a focused run', () => {
    expect(changedFilesFromEnvironment(changedFilesEnvironment(undefined), origin)).toEqual([]);
  });

  it('all reach the affected lint and test commands', () => {
    const out = join(directory, 'arguments.txt');
    const status = runOnFiles(`sh -c 'printf "%s\\n" "$@" >> ${out}' sh`, FILES, directory);
    expect(status).toBe(0);
    expect(readFileSync(out, 'utf8').split('\n').filter(Boolean)).toEqual(FILES);
  });
});
