import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { planFiling } from './filing.ts';
import { asIssue, finding, loaded, metadata, RUN_URL, single } from './fixtures.ts';
import {
  askClaude,
  groupingInput,
  groupingMode,
  groupWithModel,
  toGrouping,
  type GroupingInput,
} from './group-model.ts';
import { groupFindings, toProposal, type QaIssue } from './proposals.ts';

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
      comments: [],
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

  it('shows the start of the description and the merged findings of an issue the harness filed', () => {
    const groups = groupFindings([
      loaded('linux', 'claude', [
        finding(),
        finding({ checkId: 'build.static', title: 'Build fails', errorText: 'ENOSPC' }),
      ]),
    ]);
    const [hmr, build] = groups;
    const filed = asIssue(
      toProposal({ lead: hmr!, members: [hmr!, build!] }, [], { runUrl: RUN_URL })
    );
    const step = planFiling(filed, { repo: 'storybookjs/storybook', evidenceLinks: 'assets' }).at(
      -1
    );
    const issue = (number: number, title: string, body: string): QaIssue => ({
      number,
      title,
      state: 'open',
      labels: [],
      comments: [],
      body,
    });

    const { issues } = groupingInput(groups, [
      issue(7, 'Filed by the harness', step?.kind === 'create-issue' ? step.body : ''),
      issue(8, 'Filed by a person', '### Describe the bug\n\nSomething else entirely'),
    ]);

    expect(issues[0]!.about).toContain('index.json keeps the old entries until restart');
    expect(issues[0]!.about!.length).toBeLessThanOrEqual(500);
    expect(issues[0]!.alsoSeenAs).toEqual([expect.stringContaining('Build fails')]);
    expect(issues[1]).toEqual({ number: 8, state: 'open', title: 'Filed by a person' });
  });

  it('takes the merged findings from the list the harness wrote, and gives a closed issue no excerpt', () => {
    const groups = groupFindings([
      loaded('linux', 'claude', [
        finding({ actual: 'Nothing renders.\nAlso seen as:\n- a line the agent wrote' }),
        finding({ checkId: 'build.static', title: 'Build fails', errorText: 'ENOSPC' }),
      ]),
    ]);
    const [lead, build] = groups;
    const filed = asIssue(
      toProposal({ lead: lead!, members: [lead!, build!] }, [], { runUrl: RUN_URL })
    );
    const step = planFiling(filed, { repo: 'storybookjs/storybook', evidenceLinks: 'assets' }).at(
      -1
    );
    const body = step?.kind === 'create-issue' ? step.body : '';
    const issue = (number: number, state: QaIssue['state']): QaIssue => ({
      number,
      title: 'Filed by the harness',
      state,
      labels: [],
      comments: [],
      body,
    });

    const { issues } = groupingInput(groups, [issue(7, 'open'), issue(8, 'closed')]);

    expect(issues[0]!.alsoSeenAs).toEqual([expect.stringContaining('Build fails')]);
    expect(issues[1]).toEqual({ number: 8, state: 'closed', title: 'Filed by the harness' });
  });

  it('reads no merged findings from an issue of one finding whose agent text has the heading', () => {
    const groups = groupFindings([
      loaded('linux', 'claude', [
        finding({ actual: 'Nothing renders.\nAlso seen as:\n\n- a line the agent wrote' }),
      ]),
    ]);
    const filed = asIssue(toProposal(single(groups[0]), [], { runUrl: RUN_URL }));
    const step = planFiling(filed, { repo: 'storybookjs/storybook', evidenceLinks: 'assets' }).at(
      -1
    );

    const { issues } = groupingInput(groups, [
      {
        number: 7,
        title: 'Filed by the harness',
        state: 'open',
        labels: [],
        comments: [],
        body: step?.kind === 'create-issue' ? step.body : '',
      },
    ]);

    expect(issues[0]!.about).toContain('a line the agent wrote');
    expect(issues[0]).not.toHaveProperty('alsoSeenAs');
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
      comments: [],
      body,
    });

    const { findings } = groupingInput(groups, [
      issue(7, 'open', metadata(onOpen!)),
      issue(8, 'closed', metadata(onClosed!)),
    ]);

    expect(findings.map(({ id, filedAs }) => ({ id, filedAs }))).toEqual([
      { id: onOpen, filedAs: 7 },
      { id: onClosed, filedAs: undefined },
    ]);
  });
});

describe('groupWithModel', () => {
  it('returns the grouping of a valid answer', async () => {
    const ask = vi.fn(async () =>
      JSON.stringify({ groups: [{ members: [B, A], existingIssue: 7 }] })
    );

    await expect(groupWithModel(input, ask)).resolves.toEqual({
      groups: [{ members: [B, A], existingIssue: 7 }],
    });
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('asks again with the problems of an answer that drops a finding', async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ groups: [{ members: [A], existingIssue: null }] }))
      .mockResolvedValueOnce(
        JSON.stringify({
          groups: [
            { members: [A], existingIssue: null },
            { members: [B], existingIssue: null },
          ],
        })
      );

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
      .mockResolvedValueOnce(JSON.stringify({ groups: [{ members: [A, B], existingIssue: 9 }] }))
      .mockResolvedValueOnce(
        JSON.stringify({
          groups: [
            { members: [A], existingIssue: 9 },
            { members: [B], existingIssue: 7 },
          ],
        })
      );

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
    const ask = vi.fn(async () =>
      JSON.stringify({ groups: [{ members: [A, B], existingIssue: 8 }] })
    );

    await expect(groupWithModel(input, ask, { attempts: 2 })).rejects.toThrow(
      'group 1 names #8, which is not a listed QA issue'
    );
    expect(ask).toHaveBeenCalledTimes(2);
  });
});

describe('askClaude', () => {
  const reply = (
    stop_reason: Anthropic.Beta.BetaStopReason,
    content: Partial<Anthropic.Beta.BetaContentBlock>[]
  ) => ({ stop_reason, content }) as Anthropic.Beta.BetaMessage;
  const text = (value: string) => ({ type: 'text' as const, text: value });
  const grouped = JSON.stringify({
    groups: [
      { members: [A], existingIssue: null },
      { members: [B], existingIssue: null },
    ],
  });

  it('repairs a reply that is not JSON on the next attempt', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(reply('end_turn', [text('Here is the grouping: {"groups": [')]))
      .mockResolvedValueOnce(reply('end_turn', [text(grouped)]));

    await expect(groupWithModel(input, askClaude(create))).resolves.toEqual({
      groups: [{ members: [A] }, { members: [B] }],
    });
    expect(create).toHaveBeenCalledTimes(2);
    const [, assistant, problem] = create.mock.calls[1]![0].messages;
    expect(assistant).toEqual({
      role: 'assistant',
      content: 'Here is the grouping: {"groups": [',
    });
    expect(problem.content).toContain('The answer is not JSON');
  });

  it('stops at a refusal without asking again', async () => {
    const create = vi.fn(async () => reply('refusal', []));

    await expect(groupWithModel(input, askClaude(create))).rejects.toThrow(
      'The model refused to group the findings.'
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('stops at an answer cut off by max_tokens without asking again', async () => {
    const create = vi.fn(async () => reply('max_tokens', [text('{"groups": [{"members": ["a')]));

    await expect(groupWithModel(input, askClaude(create))).rejects.toThrow(
      "The model's answer was cut off at max_tokens (16000) before it was complete."
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('stops at a reply without a text block, naming its stop reason', async () => {
    const create = vi.fn(async () => reply('end_turn', [{ type: 'thinking' }]));

    await expect(groupWithModel(input, askClaude(create))).rejects.toThrow(
      'The model answered with no text (stop reason end_turn).'
    );
    expect(create).toHaveBeenCalledTimes(1);
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
