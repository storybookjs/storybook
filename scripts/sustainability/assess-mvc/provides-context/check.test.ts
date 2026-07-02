import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mvcPr } from '../test-helpers/fixtures.ts';
import { checkProvidesContext } from './check.ts';

const { mockJudge } = vi.hoisted(() => ({ mockJudge: vi.fn() }));

vi.mock('../../../utils/llm/client', () => ({
  getLlmClient: () => ({ judge: mockJudge, judgeText: vi.fn() }),
  configureLlmClient: vi.fn(),
  resetLlmClient: vi.fn(),
}));

describe('checkProvidesContext', () => {
  beforeEach(() => mockJudge.mockReset());

  it('calls the LLM even for trivial diffs (small diffs can be high-impact)', async () => {
    mockJudge.mockResolvedValueOnce({ status: 'fail', reasoning: 'flag flip without rationale' });
    const r = await checkProvidesContext(
      mvcPr({
        body: 'change flag',
        files: [{ path: 'core/feature-flags.ts', additions: 1, deletions: 1, status: 'modified' }],
      })
    );
    expect(mockJudge).toHaveBeenCalledOnce();
    expect(r.status).toBe('fail');
  });

  it('relays LLM PASS for diffs with rationale', async () => {
    mockJudge.mockResolvedValueOnce({ status: 'pass', reasoning: 'has rationale' });
    const r = await checkProvidesContext(
      mvcPr({ files: [{ path: 'a.ts', additions: 200, deletions: 50, status: 'modified' }] })
    );
    expect(r.status).toBe('pass');
  });

  it('relays LLM FAIL with guidance', async () => {
    mockJudge.mockResolvedValueOnce({ status: 'fail', reasoning: 'no rationale' });
    const r = await checkProvidesContext(
      mvcPr({ files: [{ path: 'a.ts', additions: 200, deletions: 50, status: 'modified' }] })
    );
    expect(r.status).toBe('fail');
    expect(r.guidance).toBeTruthy();
  });
});
