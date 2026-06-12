import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LinkedIssue, PrContext } from '../types.ts';
import { checkRealProblem } from './check.ts';

const { mockJudge } = vi.hoisted(() => ({ mockJudge: vi.fn() }));

vi.mock('../../../utils/llm/client', () => ({
  getLlmClient: () => ({ judge: mockJudge, judgeText: vi.fn() }),
  configureLlmClient: vi.fn(),
  resetLlmClient: vi.fn(),
}));

const issue = (overrides: Partial<LinkedIssue> = {}): LinkedIssue => ({
  owner: 'storybookjs',
  repo: 'storybook',
  number: 42,
  url: 'u',
  title: 'I',
  body: 'b',
  state: 'open',
  labels: [],
  ...overrides,
});

const pr = (overrides: Partial<PrContext> = {}): PrContext => ({
  owner: 'storybookjs',
  repo: 'storybook',
  number: 1,
  url: 'u',
  title: 't',
  body: 'b',
  author: 'a',
  isDraft: false,
  headSha: 'sha',
  labels: [],
  files: [],
  linkedIssues: [],
  otherIssues: [], otherPrs: [], unresolved: [],
  ...overrides,
});

describe('checkRealProblem', () => {
  beforeEach(() => mockJudge.mockReset());

  it('FAIL when no linked issues (no LLM call)', async () => {
    const r = await checkRealProblem(pr());
    expect(r.status).toBe('fail');
    expect(r.evidence).toMatch(/no linked issue/i);
    expect(mockJudge).not.toHaveBeenCalled();
  });

  it('FAIL when only linked issue is closed (no LLM call)', async () => {
    const r = await checkRealProblem(pr({ linkedIssues: [issue({ state: 'closed' })] }));
    expect(r.status).toBe('fail');
    expect(mockJudge).not.toHaveBeenCalled();
  });

  it('PASS when LLM judges substantive match', async () => {
    mockJudge.mockResolvedValueOnce({
      matchesIssue: true,
      category: 'bug',
      reasoning: 'fixes core path',
    });
    const r = await checkRealProblem(pr({ linkedIssues: [issue()] }));
    expect(r.status).toBe('pass');
    expect(r.evidence).toContain('bug');
  });

  it('FAIL when LLM judges no match', async () => {
    mockJudge.mockResolvedValueOnce({
      matchesIssue: false,
      category: 'bug',
      reasoning: 'tangential',
    });
    const r = await checkRealProblem(pr({ linkedIssues: [issue()] }));
    expect(r.status).toBe('fail');
  });

  it('FAIL when feature does not fit any accepted category', async () => {
    mockJudge.mockResolvedValueOnce({
      matchesIssue: true,
      category: 'feature',
      reasoning: 'matches',
      featureFit: 'none',
    });
    const r = await checkRealProblem(pr({ linkedIssues: [issue()] }));
    expect(r.status).toBe('fail');
    expect(r.evidence).toMatch(/augments-API/i);
  });

  it('PASS when feature fits one of accepted categories', async () => {
    mockJudge.mockResolvedValueOnce({
      matchesIssue: true,
      category: 'feature',
      reasoning: 'matches',
      featureFit: 'augments-api',
    });
    const r = await checkRealProblem(pr({ linkedIssues: [issue()] }));
    expect(r.status).toBe('pass');
  });

  it('WARN when match but linked-issue refs are broken', async () => {
    mockJudge.mockResolvedValueOnce({
      matchesIssue: true,
      category: 'bug',
      reasoning: 'ok',
    });
    const r = await checkRealProblem(
      pr({ linkedIssues: [issue()], unresolved: ['storybookjs/storybook#999'] })
    );
    expect(r.status).toBe('warn');
    expect(r.evidence).toContain('#999');
  });
});
