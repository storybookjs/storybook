import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { beforeAll, describe, expect, it } from 'vitest';

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

  beforeAll(() => {
    origin = mkdtempSync(join(tmpdir(), 'merge-base-origin-'));
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

  // A checkout of `branch` with one commit, as the setup job's.
  const run = (branch: string, baseBranch: string) => {
    const checkout = mkdtempSync(join(tmpdir(), 'merge-base-checkout-'));
    git(checkout, 'clone', '--quiet', '--depth=1', '--branch', branch, `file://${origin}`, '.');
    const out = join(mkdtempSync(join(tmpdir(), 'merge-base-out-')), 'merge-base');
    let failed = false;
    try {
      execFileSync('bash', [SCRIPT, branch, baseBranch, out], { cwd: checkout, stdio: 'pipe' });
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

  it('leaves a marker for the step that waits when git fails', () => {
    expect(run('feature', 'no-such-branch')).toMatchObject({
      failed: true,
      failedMarker: true,
      mergeBase: undefined,
    });
  });
});
