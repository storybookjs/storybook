import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrContext } from '../types.ts';
import { checkProvidesContext } from './check.ts';

const { mockJudge } = vi.hoisted(() => ({ mockJudge: vi.fn() }));

vi.mock('../../../utils/llm/client', () => ({
  getLlmClient: () => ({ judge: mockJudge }),
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

  it('PASS for trivial diff via short-circuit (no LLM call)', async () => {
    const r = await checkProvidesContext(
      pr({ files: [{ path: 'a.ts', additions: 3, deletions: 0, status: 'modified' }] })
    );
    expect(r.status).toBe('pass');
    expect(mockJudge).not.toHaveBeenCalled();
  });

  it('relays LLM PASS for non-trivial diff', async () => {
    mockJudge.mockResolvedValueOnce({ verdict: 'pass', reasoning: 'has rationale' });
    const r = await checkProvidesContext(
      pr({ files: [{ path: 'a.ts', additions: 200, deletions: 50, status: 'modified' }] })
    );
    expect(r.status).toBe('pass');
  });

  it('relays LLM FAIL for non-trivial diff with no rationale', async () => {
    mockJudge.mockResolvedValueOnce({ verdict: 'fail', reasoning: 'no rationale' });
    const r = await checkProvidesContext(
      pr({ files: [{ path: 'a.ts', additions: 200, deletions: 50, status: 'modified' }] })
    );
    expect(r.status).toBe('fail');
    expect(r.guidance).toBeTruthy();
  });
});
