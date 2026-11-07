import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

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

const git = (cwd: string, args: string[], input?: string) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
    cwd,
    encoding: 'utf8',
    input,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'ignore'],
  });

// The large change is committed straight into the index and cloned without a checkout: on disk,
// the paths would pass Windows' 260-character limit, which Git for Windows enforces by default.
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'changed-files-'));
  origin = join(directory, 'origin');
  mkdirSync(origin);
  git(origin, ['init', '--quiet', '--initial-branch=next']);
  writeFileSync(join(origin, 'README.md'), 'base');
  git(origin, ['add', '.']);
  git(origin, ['commit', '--quiet', '-m', 'base']);
  git(origin, ['checkout', '--quiet', '-b', 'pr']);
  const empty = git(origin, ['hash-object', '-w', '--stdin'], '').trim();
  git(
    origin,
    ['update-index', '--add', '--index-info'],
    FILES.map((file) => `100644 ${empty}\t${file}\n`).join('')
  );
  git(origin, ['commit', '--quiet', '-m', 'a large change']);
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
      '--no-checkout',
      '--depth=1',
      '--branch=pr',
      pathToFileURL(origin).href,
      checkout,
    ]);
    expect(changedFilesFromEnvironment(env, checkout)).toEqual(FILES);
  }, 30_000);

  it('fail when the diff is not the one the run was planned from', () => {
    const { base } = focusDiff('next', origin);
    expect(() =>
      changedFilesFromEnvironment(
        { CI_CHANGED_FILES_BASE: base, CI_CHANGED_FILES_COUNT: '5' },
        origin
      )
    ).toThrow('6000 files changed');
  }, 30_000);

  it('are none outside a focused run', () => {
    expect(changedFilesFromEnvironment(changedFilesEnvironment(undefined), origin)).toEqual([]);
  });

  // xargs starts a shell per batch, which takes seconds in Git Bash on Windows.
  it('all reach the affected lint and test commands', () => {
    const out = join(directory, 'arguments.txt');
    const status = runOnFiles(`sh -c 'printf "%s\\n" "$@" >> ${out}' sh`, FILES, directory);
    expect(status).toBe(0);
    expect(readFileSync(out, 'utf8').split('\n').filter(Boolean)).toEqual(FILES);
  }, 60_000);
});
