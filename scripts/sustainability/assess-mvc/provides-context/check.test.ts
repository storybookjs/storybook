import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrContext } from '../types.ts';
import { checkProvidesContext } from './check.ts';

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
  body: '## What I did\n…',
  author: 'a',
  isDraft: false,
  headSha: 'sha',
  labels: [],
  files: [],
  linkedIssues: [],
  brokenLinkRefs: [],
  ...overrides,
});

describe('checkProvidesContext', () => {
  beforeEach(() => mockJudge.mockReset());

  it('calls the LLM even for trivial diffs (small diffs can be high-impact)', async () => {
    mockJudge.mockResolvedValueOnce({ verdict: 'fail', reasoning: 'flag flip without rationale' });
    const r = await checkProvidesContext(
      pr({
        body: 'change flag',
        files: [{ path: 'core/feature-flags.ts', additions: 1, deletions: 1, status: 'modified' }],
      })
    );
    expect(mockJudge).toHaveBeenCalledOnce();
    expect(r.status).toBe('fail');
  });

  it('relays LLM PASS for diffs with rationale', async () => {
    mockJudge.mockResolvedValueOnce({ verdict: 'pass', reasoning: 'has rationale' });
    const r = await checkProvidesContext(
      pr({ files: [{ path: 'a.ts', additions: 200, deletions: 50, status: 'modified' }] })
    );
    expect(r.status).toBe('pass');
  });

  it('relays LLM FAIL with guidance', async () => {
    mockJudge.mockResolvedValueOnce({ verdict: 'fail', reasoning: 'no rationale' });
    const r = await checkProvidesContext(
      pr({ files: [{ path: 'a.ts', additions: 200, deletions: 50, status: 'modified' }] })
    );
    expect(r.status).toBe('fail');
    expect(r.guidance).toBeTruthy();
  });
});
