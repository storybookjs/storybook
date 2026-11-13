import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findChangedFiles } from './changed-files.ts';
import { ChangeDetectionFailureError, ChangeDetectionUnavailableError } from './errors.ts';

// A real repository: what counts as changed is git's answer, so mocking git would test nothing.
let repo: string;

function git(...args: string[]) {
  execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
}

function write(file: string, content = 'x') {
  mkdirSync(join(repo, file, '..'), { recursive: true });
  writeFileSync(join(repo, file), content);
}

beforeEach(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'sb-changed-')));
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  write('app/src/Button.tsx');
  write('app/src/Gone.tsx');
  write('app/src/Committed.tsx');
  git('add', '-A');
  git('commit', '-qm', 'base');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('findChangedFiles', () => {
  it('reads staged, unstaged, untracked and deleted files, as absolute paths', async () => {
    write('app/src/Button.tsx', 'changed');
    write('app/src/Staged.tsx');
    git('add', 'app/src/Staged.tsx');
    write('app/src/New.stories.tsx');
    unlinkSync(join(repo, 'app/src/Gone.tsx'));

    // From a project below the repository root, as in a monorepo.
    const files = await findChangedFiles({ cwd: join(repo, 'app') });

    expect(files.sort()).toEqual(
      ['Button.tsx', 'Gone.tsx', 'New.stories.tsx', 'Staged.tsx'].map((file) =>
        join(repo, 'app/src', file).replaceAll('\\', '/')
      )
    );
  });

  it('adds the changes committed since a ref', async () => {
    git('checkout', '-qb', 'feature');
    write('app/src/Committed.tsx', 'changed');
    git('commit', '-qam', 'feature work');

    expect(await findChangedFiles({ cwd: repo })).toEqual([]);
    expect(await findChangedFiles({ cwd: repo, since: 'main' })).toEqual([
      join(repo, 'app/src/Committed.tsx').replaceAll('\\', '/'),
    ]);
  });

  it('names an unknown ref in one line', async () => {
    await expect(findChangedFiles({ cwd: repo, since: 'nope' })).rejects.toThrow(
      new ChangeDetectionFailureError('`nope` is not a known git ref.')
    );
  });

  it('refuses a ref that git would read as an option', async () => {
    await expect(findChangedFiles({ cwd: repo, since: '--output=x' })).rejects.toBeInstanceOf(
      ChangeDetectionFailureError
    );
  });

  it('reports a directory outside any repository as unavailable', async () => {
    const outside = realpathSync(mkdtempSync(join(tmpdir(), 'sb-no-git-')));
    const ceiling = process.env.GIT_CEILING_DIRECTORIES;
    process.env.GIT_CEILING_DIRECTORIES = join(outside, '..');
    try {
      await expect(findChangedFiles({ cwd: outside })).rejects.toBeInstanceOf(
        ChangeDetectionUnavailableError
      );
    } finally {
      process.env.GIT_CEILING_DIRECTORIES = ceiling;
      if (ceiling === undefined) {
        delete process.env.GIT_CEILING_DIRECTORIES;
      }
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
