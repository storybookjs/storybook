import { describe, expect, it } from 'vitest';

import { logLines, parseTarget, summarizeLog } from './nx-cloud-status.ts';

describe('parseTarget', () => {
  it('reads a CIPE id from an id or a cloud.nx.app/cipes link', () => {
    expect(parseTarget('6aebb385d424d5137fef44a3')).toEqual({
      kind: 'cipe',
      cipeId: '6aebb385d424d5137fef44a3',
    });
    expect(parseTarget('https://cloud.nx.app/cipes/6aebb385d424d5137fef44a3?tab=tasks')).toEqual({
      kind: 'cipe',
      cipeId: '6aebb385d424d5137fef44a3',
    });
  });

  it('reads a pull request number from a number, #number or a pull request link', () => {
    expect(parseTarget('37181')).toEqual({ kind: 'branch', branch: '37181' });
    expect(parseTarget('#37181')).toEqual({ kind: 'branch', branch: '37181' });
    expect(parseTarget('https://github.com/storybookjs/storybook/pull/37181/checks')).toEqual({
      kind: 'branch',
      branch: '37181',
    });
  });

  it('reads a GitHub Actions run from its id, run group or link', () => {
    expect(parseTarget('41939428103')).toEqual({ kind: 'run', runId: '41939428103' });
    expect(parseTarget('41939428103-2')).toEqual({
      kind: 'run',
      runId: '41939428103',
      attempt: 2,
    });
    expect(
      parseTarget('https://github.com/storybookjs/storybook/actions/runs/41939428103/attempts/2')
    ).toEqual({ kind: 'run', runId: '41939428103', attempt: 2 });
    expect(
      parseTarget('https://github.com/storybookjs/storybook/actions/runs/41939428103/job/123')
    ).toEqual({ kind: 'run', runId: '41939428103', jobId: '123' });
  });

  it('keeps pull request numbers and branches that look like run groups apart from runs', () => {
    expect(parseTarget('9999999')).toEqual({ kind: 'branch', branch: '9999999' });
    expect(parseTarget('2024-11')).toEqual({ kind: 'branch', branch: '2024-11' });
    expect(parseTarget('41939428103-0')).toEqual({ kind: 'branch', branch: '41939428103-0' });
  });

  it('reads the branch from an NX Cloud overview link', () => {
    expect(
      parseTarget(
        'https://cloud.nx.app/orgs/606dcb5cdc2a2b00059cc0e9/workspaces/6929fbef73e98d8094d2a343/overview?branch=37181'
      )
    ).toEqual({ kind: 'branch', branch: '37181' });
  });

  it('rejects other links instead of reading an id out of them', () => {
    expect(() => parseTarget('https://cloud.nx.app/runs/v7niaenz5A')).toThrow(/Cannot read/);
  });

  it('takes anything else as a branch, even when it looks like a commit', () => {
    expect(parseTarget('kasper/nx-cloud-revive')).toEqual({
      kind: 'branch',
      branch: 'kasper/nx-cloud-revive',
    });
    expect(parseTarget('b801775ebf75570dd21dc5dacefd2f1a754196a8')).toEqual({
      kind: 'branch',
      branch: 'b801775ebf75570dd21dc5dacefd2f1a754196a8',
    });
  });
});

describe('summarizeLog', () => {
  it('keeps the lines that name failures before the tail, without colours', () => {
    const lines = logLines(
      [
        '\x1b[31m FAIL \x1b[39m core/src/foo.test.ts > does a thing',
        '[Error: ResizeObserver loop completed]',
        'src/index.ts(3,1): error TS2304: Cannot find name x.',
        ...Array.from({ length: 30 }, (_, i) => `line ${i}`),
      ].join('\n')
    );
    const summary = summarizeLog(lines);

    expect(summary.slice(0, 3)).toEqual([
      ' FAIL  core/src/foo.test.ts > does a thing',
      'src/index.ts(3,1): error TS2304: Cannot find name x.',
      '…',
    ]);
    expect(summary.at(-1)).toBe('line 29');
    expect(summary).toHaveLength(3 + 20);
  });

  it('returns a short log whole', () => {
    expect(summarizeLog(['a', 'b'])).toEqual(['a', 'b']);
  });
});
