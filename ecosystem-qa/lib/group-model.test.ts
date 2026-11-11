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

  it('marks a finding whose fingerprint an open issue carries, and not one on a closed issue', () => {
    const groups = groupFindings([
      loaded('linux', 'claude', [
        finding(),
        finding({ checkId: 'build.static', title: 'Build fails', errorText: 'ENOSPC' }),
      ]),
    ]);
    const [onOpen, onClosed] = groups.map((group) => group.fingerprint);
    const issue = (number: number, state: QaIssue['state'], body: string): QaIssue => ({
      number,
      title: 'Filed before',
      state,
      labels: [],
      body,
    });

    const { findings } = groupingInput(groups, [
      issue(7, 'open', `fingerprint: ${onOpen}`),
      issue(8, 'closed', `fingerprint: ${onClosed}`),
    ]);

    expect(findings.map(({ id, filedAs }) => ({ id, filedAs }))).toEqual([
      { id: onOpen, filedAs: 7 },
      { id: onClosed, filedAs: undefined },
    ]);
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

  it('asks again when a group pulls a finding away from the open issue it is already on', async () => {
    const filed: GroupingInput = {
      findings: input.findings.map((entry) => (entry.id === B ? { ...entry, filedAs: 7 } : entry)),
      issues: [...input.issues, { number: 9, state: 'open', title: 'Dev server crashes' }],
    };
    const ask = vi
      .fn()
      .mockResolvedValueOnce({ groups: [{ members: [A, B], existingIssue: 9 }] })
      .mockResolvedValueOnce({
        groups: [
          { members: [A], existingIssue: 9 },
          { members: [B], existingIssue: 7 },
        ],
      });

    await expect(groupWithModel(filed, ask)).resolves.toEqual({
      groups: [
        { members: [A], existingIssue: 9 },
        { members: [B], existingIssue: 7 },
      ],
    });
    expect(ask.mock.calls[1]![0].at(-1).content).toContain(
      `group 1 names #9, but ${B} is already on #7`
    );
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
