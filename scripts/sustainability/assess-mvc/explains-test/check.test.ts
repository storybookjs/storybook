import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrContext } from '../types.ts';
import { checkExplainsHowToTest } from './check.ts';

const { mockJudge } = vi.hoisted(() => ({ mockJudge: vi.fn() }));

vi.mock('../../../utils/llm/client', () => ({
  getLlmClient: () => ({ judge: mockJudge, judgeText: vi.fn() }),
  configureLlmClient: vi.fn(),
  resetLlmClient: vi.fn(),
}));

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
  files: [{ path: 'a.ts', additions: 1, deletions: 0, status: 'modified' }],
  linkedIssues: [],
  brokenLinkRefs: [],
  ...overrides,
});

describe('checkExplainsHowToTest', () => {
  beforeEach(() => mockJudge.mockReset());

  it('FAIL when LLM judges absent or self-report-only', async () => {
    mockJudge.mockResolvedValueOnce({ verdict: 'fail', reasoning: 'empty section' });
    const r = await checkExplainsHowToTest(pr());
    expect(r.status).toBe('fail');
    expect(r.guidance).toBeTruthy();
  });

  it('PASS when LLM judges concrete reproducible steps', async () => {
    mockJudge.mockResolvedValueOnce({ verdict: 'pass', reasoning: 'concrete steps' });
    const r = await checkExplainsHowToTest(pr());
    expect(r.status).toBe('pass');
  });
});
