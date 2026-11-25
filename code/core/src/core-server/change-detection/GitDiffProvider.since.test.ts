import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OpenServiceGitRefError } from '../../server-errors.ts';
import { GitDiffProvider } from './GitDiffProvider.ts';

// A real repository: which files changed since a ref is git's answer, so a mocked git would test
// nothing.
let repo: string;

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: repo, stdio: 'pipe', encoding: 'utf8' }).trim();
}

function write(file: string, content = 'x') {
  mkdirSync(join(repo, file, '..'), { recursive: true });
  writeFileSync(join(repo, file), content);
}

async function changedFiles(since?: string, cwd = repo) {
  const result = await new GitDiffProvider(cwd).getChangedFiles(since);
  return { changed: [...result.changed].sort(), new: [...result.new].sort() };
}

beforeEach(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), 'sb-since-')));
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  git('config', 'commit.gpgsign', 'false');
  write('app/src/Button.tsx');
  write('app/src/Gone.tsx');
  write('app/src/Header.tsx');
  git('add', '-A');
  git('commit', '-qm', 'base');
  git('checkout', '-qb', 'feature');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('GitDiffProvider.getChangedFiles(since)', () => {
  it('adds the files committed since the ref to the uncommitted ones', async () => {
    write('app/src/Button.tsx', 'committed change');
    // Its own content, or git reads the deleted file as renamed to this one.
    write('app/src/Card.stories.tsx', 'a new story file');
    git('rm', '-q', 'app/src/Gone.tsx');
    git('add', '-A');
    git('commit', '-qm', 'feature work');
    write('app/src/Header.tsx', 'uncommitted change');
    write('app/src/Untracked.stories.tsx');

    expect(await changedFiles()).toEqual({
      changed: ['app/src/Header.tsx'],
      new: ['app/src/Untracked.stories.tsx'],
    });
    // From a project below the repository root, as in a monorepo. The deleted file is left out.
    expect(await changedFiles('main', join(repo, 'app'))).toEqual({
      changed: ['app/src/Button.tsx', 'app/src/Header.tsx'],
      new: ['app/src/Card.stories.tsx', 'app/src/Untracked.stories.tsx'],
    });
  });

  it('reads staged and intent-to-add files, and leaves out a committed file deleted since', async () => {
    write('app/src/Button.tsx', 'committed change');
    write('app/src/Card.stories.tsx', 'a new story file');
    git('add', '-A');
    git('commit', '-qm', 'feature work');
    rmSync(join(repo, 'app/src/Button.tsx'));
    rmSync(join(repo, 'app/src/Card.stories.tsx'));
    write('app/src/Header.tsx', 'staged change');
    git('add', 'app/src/Header.tsx');
    write('app/src/Intent.stories.tsx', 'intent to add');
    git('add', '-N', 'app/src/Intent.stories.tsx');

    expect(await changedFiles('main')).toEqual({
      changed: ['app/src/Header.tsx'],
      new: ['app/src/Intent.stories.tsx'],
    });
  });

  it('lists only the uncommitted changes for a ref that is HEAD', async () => {
    write('app/src/Button.tsx', 'committed change');
    git('commit', '-qam', 'feature work');
    write('app/src/Header.tsx', 'uncommitted change');

    expect(await changedFiles('HEAD')).toEqual({ changed: ['app/src/Header.tsx'], new: [] });
  });

  it('compares with the commit the branch forked from, not with the tip of the ref', async () => {
    write('app/src/Button.tsx', 'feature change');
    git('commit', '-qam', 'feature work');
    git('checkout', '-q', 'main');
    write('app/src/Header.tsx', 'someone else on main');
    git('commit', '-qam', 'main moves on');
    git('checkout', '-q', 'feature');

    expect(await changedFiles('main')).toEqual({ changed: ['app/src/Button.tsx'], new: [] });
  });

  it('takes a commit hash or a relative ref', async () => {
    const base = git('rev-parse', 'HEAD');
    write('app/src/Button.tsx', 'feature change');
    git('commit', '-qam', 'feature work');

    expect(await changedFiles(base)).toEqual({ changed: ['app/src/Button.tsx'], new: [] });
    expect(await changedFiles('HEAD~1')).toEqual({ changed: ['app/src/Button.tsx'], new: [] });
  });

  it('names an unknown ref in one line', async () => {
    await expect(changedFiles('nope')).rejects.toThrow(
      new OpenServiceGitRefError({ ref: 'nope', reason: 'unknown' })
    );
    // A file is not a ref either: `--changed Button.tsx` asks for the changes since `Button.tsx`.
    await expect(changedFiles('app/src/Button.tsx')).rejects.toThrow(
      '`app/src/Button.tsx` is not a known git ref.'
    );
  });

  it('refuses a ref that git would read as an option', async () => {
    await expect(changedFiles('--output=x')).rejects.toThrow(
      new OpenServiceGitRefError({ ref: '--output=x', reason: 'unknown' })
    );
  });

  it('says to fetch more history when the ref shares no commit with HEAD', async () => {
    git('checkout', '-q', '--orphan', 'unrelated');
    git('commit', '-qm', 'unrelated root', '--allow-empty');

    await expect(changedFiles('main')).rejects.toThrow(
      '`main` and HEAD have no common commit in this clone. In a shallow clone, fetch more history first: `git fetch --unshallow`.'
    );
  });
});
