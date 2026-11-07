import { execFileSync } from 'node:child_process';

import { ROOT_DIRECTORY } from './constants.ts';

// The `git status --porcelain` entries of the files that differ from the commit and that git does
// not ignore, such as `?? chromatic-diagnostics.json`.
export function checkoutChanges(cwd: string = ROOT_DIRECTORY): Set<string> {
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd,
    encoding: 'utf8',
  });
  return new Set(status.split('\n').filter(Boolean));
}

export function checkoutChangesSince(before: Set<string>, cwd?: string): string[] {
  return [...checkoutChanges(cwd)].filter((entry) => !before.has(entry));
}
