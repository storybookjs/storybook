import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

import { join } from 'pathe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT = join(import.meta.dirname, 'merge-base.sh');

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  }).trim();

describe('merge-base.sh', () => {
  let origin: string;
  const commit = (message: string) => {
    writeFileSync(join(origin, 'file.txt'), message);
    git(origin, 'add', 'file.txt');
    git(origin, 'commit', '--quiet', '-m', message);
    return git(origin, 'rev-parse', 'HEAD');
  };
  const commits: Record<string, string> = {};
  const dirs: string[] = [];
  const tempDir = (prefix: string) => {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    dirs.push(dir);
    return dir;
  };

  beforeAll(() => {
    origin = tempDir('merge-base-origin-');
    git(origin, 'init', '--quiet', '--initial-branch=next');
    // As GitHub: a clone may leave trees and blobs out.
    git(origin, 'config', 'uploadpack.allowFilter', 'true');
    git(origin, 'config', 'uploadpack.allowAnySHA1InWant', 'true');
    commits.n1 = commit('n1');
    commits.n2 = commit('n2');
    git(origin, 'checkout', '--quiet', '-b', 'feature');
    commits.f1 = commit('f1');
    git(origin, 'checkout', '--quiet', 'next');
    commits.n3 = commit('n3');
    git(origin, 'checkout', '--quiet', 'feature');
    git(origin, 'merge', '--quiet', '--no-edit', '-X', 'theirs', 'next');
    commits.f2 = commit('f2');
    git(origin, 'checkout', '--quiet', 'next');
    commits.n4 = commit('n4');
    git(origin, 'checkout', '--quiet', '--orphan', 'unrelated');
    commits.u1 = commit('u1');
    git(origin, 'checkout', '--quiet', 'next');
  });

  afterAll(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // A checkout of `branch` with one commit, as the setup job's.
  const checkOut = (branch: string) => {
    const checkout = tempDir('merge-base-checkout-');
    git(
      checkout,
      'clone',
      '--quiet',
      '--depth=1',
      '--branch',
      branch,
      pathToFileURL(origin).href,
      '.'
    );
    return checkout;
  };
  const run = (branch: string, baseBranch: string, checkout = checkOut(branch)) => {
    const out = join(tempDir('merge-base-out-'), 'merge-base');
    let failed = false;
    try {
      execFileSync('bash', [SCRIPT, baseBranch, out], { cwd: checkout, stdio: 'pipe' });
    } catch {
      failed = true;
    }
    return {
      checkout,
      failed,
      failedMarker: existsSync(`${out}.failed`),
      mergeBase: existsSync(out) ? readFileSync(out, 'utf8').trim() : undefined,
    };
  };

  it('finds the merge base that git finds with the whole history, and fetches it into the checkout', () => {
    const result = run('feature', 'next');
    expect(result.mergeBase).toBe(git(origin, 'merge-base', 'next', 'feature'));
    expect(result.mergeBase).toBe(commits.n3);
    expect(git(result.checkout, 'diff', '--name-only', result.mergeBase!, 'HEAD')).toBe('file.txt');
  });

  it('writes no merge base when the branches share no commit, so every task runs', () => {
    expect(run('unrelated', 'next')).toMatchObject({
      failed: false,
      failedMarker: false,
      mergeBase: '',
    });
  });

  it('finds the merge base of the checked-out commit after a force-push moved the branch', () => {
    const checkout = checkOut('feature');
    git(origin, 'branch', '--force', 'feature', commits.u1);

    const result = run('feature', 'next', checkout);

    git(origin, 'branch', '--force', 'feature', commits.f2);
    expect(result).toMatchObject({ failed: false, mergeBase: commits.n3 });
  });

  it('leaves a marker for the step that waits when git fails', () => {
    expect(run('feature', 'no-such-branch')).toMatchObject({
      failed: true,
      failedMarker: true,
      mergeBase: undefined,
    });
  });
});
