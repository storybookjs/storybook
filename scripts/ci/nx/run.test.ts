import { describe, expect, it } from 'vitest';

import { commandFor } from './run.ts';

describe('the NX command of a run', () => {
  const group = { targets: ['check', 'sandbox'], projects: 'tag:library,tag:ci:normal' };

  it('runs every task of the group outside a pull request', () => {
    expect(commandFor(group, undefined)).toEqual([
      'nx',
      'run-many',
      '--targets=check,sandbox',
      '--projects=tag:library,tag:ci:normal',
      '--configuration=production',
    ]);
  });

  it('runs only what a change reaches on a pull request, excluding every other project', () => {
    expect(commandFor(group, 'abc123')).toEqual([
      'nx',
      'affected',
      '--targets=check,sandbox',
      '--exclude=*,!tag:library,!tag:ci:normal',
      '--base=abc123',
      '--head=HEAD',
      '--configuration=production',
    ]);
  });
});
