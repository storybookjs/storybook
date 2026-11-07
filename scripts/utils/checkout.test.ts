import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkoutChanges, checkoutChangesSince } from './checkout.ts';

let repo: string;

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'checkout-test-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo });
  git('init', '--quiet');
  writeFileSync(join(repo, '.gitignore'), 'sandbox\n');
  writeFileSync(join(repo, 'tracked.txt'), 'committed\n');
  git('add', '.');
  git(
    '-c',
    'user.name=test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '--quiet',
    '-m',
    'init'
  );
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('checkoutChangesSince', () => {
  it('reports the files a task adds or changes that git does not ignore', () => {
    const before = checkoutChanges(repo);
    writeFileSync(join(repo, 'chromatic-diagnostics.json'), '{}');
    mkdirSync(join(repo, 'nested'));
    writeFileSync(join(repo, 'nested', 'left.ts'), '');
    writeFileSync(join(repo, 'tracked.txt'), 'changed\n');

    expect(checkoutChangesSince(before, repo)).toEqual(
      expect.arrayContaining([
        '?? chromatic-diagnostics.json',
        '?? nested/left.ts',
        ' M tracked.txt',
      ])
    );
    expect(checkoutChangesSince(before, repo)).toHaveLength(3);
  });

  it('ignores gitignored files', () => {
    const before = checkoutChanges(repo);
    mkdirSync(join(repo, 'sandbox'));
    writeFileSync(join(repo, 'sandbox', 'chromatic-diagnostics.json'), '{}');

    expect(checkoutChangesSince(before, repo)).toEqual([]);
  });

  it('does not report what was already there before the task', () => {
    writeFileSync(join(repo, 'earlier.txt'), '');
    const before = checkoutChanges(repo);

    expect(checkoutChangesSince(before, repo)).toEqual([]);
  });
});
