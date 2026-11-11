import { describe, expect, it, vi } from 'vitest';

import { finding, loaded } from './fixtures.ts';
import {
  groupingInput,
  groupingMode,
  groupWithModel,
  toGrouping,
  type GroupingInput,
} from './group-model.ts';
import { groupFindings, type QaIssue } from './proposals.ts';

const A = 'aaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbb';

const input: GroupingInput = {
  findings: [A, B].map((id) => ({
    id,
    check: 'build.static',
    seenIn: [{ repo: 'storybookjs/mealdrop', os: 'linux', engine: 'claude' }],
    title: 'Build fails',
    actual: 'ENOSPC',
  })),
  issues: [{ number: 7, state: 'open', title: 'Build fails with ENOSPC' }],
};

describe('groupingInput', () => {
  it('caps an oversized field and keeps the ids and checks', () => {
    const groups = groupFindings([
      loaded('linux', 'claude', [
        finding({ actual: 'x'.repeat(10_000) }),
        finding({ checkId: 'build.static', title: 'Build fails', errorText: 'ENOSPC' }),
      ]),
    ]);
    const issue: QaIssue = {
      number: 7,
      title: 'Build fails',
      state: 'open',
      labels: [],
      body: 'x',
    };

    const { findings, issues } = groupingInput(groups, [issue]);

    expect(findings.map(({ id, check }) => ({ id, check }))).toEqual(
      groups.map((group) => ({ id: group.fingerprint, check: group.finding.checkId }))
    );
    expect(findings[0]!.actual.length).toBeLessThan(1_000);
    expect(findings[0]!.seenIn).toEqual([
      { repo: 'storybookjs/mealdrop', os: 'linux', engine: 'claude' },
    ]);
    expect(issues).toEqual([{ number: 7, state: 'open', title: 'Build fails' }]);
  });
});

describe('groupWithModel', () => {
  it('returns the grouping of a valid answer', async () => {
    const ask = vi.fn(async () => ({ groups: [{ members: [B, A], existingIssue: 7 }] }));

    await expect(groupWithModel(input, ask)).resolves.toEqual({
      groups: [{ members: [B, A], existingIssue: 7 }],
    });
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('asks again with the problems of an answer that drops a finding', async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce({ groups: [{ members: [A], existingIssue: null }] })
      .mockResolvedValueOnce({
        groups: [
          { members: [A], existingIssue: null },
          { members: [B], existingIssue: null },
        ],
      });

    await expect(groupWithModel(input, ask)).resolves.toEqual({
      groups: [{ members: [A] }, { members: [B] }],
    });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls[1]![0].at(-1).content).toContain(`${B} is in no group`);
  });

  it('throws with the problems of the last answer when no attempt fits', async () => {
    const ask = vi.fn(async () => ({ groups: [{ members: [A, B], existingIssue: 8 }] }));

    await expect(groupWithModel(input, ask, { attempts: 2 })).rejects.toThrow(
      'group 1 names #8, which is not a listed QA issue'
    );
    expect(ask).toHaveBeenCalledTimes(2);
  });
});

describe('toGrouping', () => {
  it('leaves out an existing issue that is null', () => {
    expect(toGrouping({ groups: [{ members: [A], existingIssue: null }] })).toEqual({
      groups: [{ members: [A] }],
    });
  });
});

describe('groupingMode', () => {
  it('asks the model whenever a key is set', () => {
    expect(groupingMode({ ANTHROPIC_API_KEY: 'key' })).toBe('model');
    expect(groupingMode({ ANTHROPIC_API_KEY: 'key', GITHUB_ACTIONS: 'true' })).toBe('model');
  });

  it('skips the grouping on a local run without a key', () => {
    expect(groupingMode({})).toBe('skip');
    expect(groupingMode({ ANTHROPIC_API_KEY: '' })).toBe('skip');
  });

  it('fails on a runner without a key', () => {
    expect(groupingMode({ GITHUB_ACTIONS: 'true' })).toBe('fail');
  });
});
