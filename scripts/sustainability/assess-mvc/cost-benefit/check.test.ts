import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupMsw } from '../../../utils/test-helpers/msw.ts';
import type { PrContext } from '../types.ts';
import { checkCostBenefit } from './check.ts';

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
  body: 'b',
  author: 'a',
  isDraft: false,
  headSha: 'sha',
  labels: [],
  files: [],
  linkedIssues: [],
  brokenLinkRefs: [],
  ...overrides,
});

describe('checkCostBenefit', () => {
  const { server, http, HttpResponse } = setupMsw();
  beforeEach(() => mockJudge.mockReset());

  it('PASS for trivial diff regardless of LLM (no LLM call)', async () => {
    const r = await checkCostBenefit(
      pr({ files: [{ path: 'a.ts', additions: 5, deletions: 1, status: 'modified' }] })
    );
    expect(r.status).toBe('pass');
    expect(mockJudge).not.toHaveBeenCalled();
  });

  it('relays LLM PASS for larger changes', async () => {
    mockJudge.mockResolvedValueOnce({ verdict: 'pass', reasoning: 'proportionate' });
    const r = await checkCostBenefit(
      pr({ files: [{ path: 'a.ts', additions: 200, deletions: 0, status: 'modified' }] })
    );
    expect(r.status).toBe('pass');
  });

  it('relays LLM WARN', async () => {
    mockJudge.mockResolvedValueOnce({ verdict: 'warn', reasoning: 'concerns' });
    const r = await checkCostBenefit(
      pr({ files: [{ path: 'a.ts', additions: 200, deletions: 0, status: 'modified' }] })
    );
    expect(r.status).toBe('warn');
  });

  it('relays LLM FAIL with guidance', async () => {
    mockJudge.mockResolvedValueOnce({
      verdict: 'fail',
      reasoning: 'edge-case + huge diff',
    });
    const r = await checkCostBenefit(
      pr({ files: [{ path: 'a.ts', additions: 800, deletions: 100, status: 'modified' }] })
    );
    expect(r.status).toBe('fail');
    expect(r.guidance).toBeTruthy();
  });

  it('fetches reactions for the first open linked issue', async () => {
    server.use(
      http.get('https://api.github.com/repos/storybookjs/storybook/issues/42', () =>
        HttpResponse.json({
          number: 42,
          title: 'I',
          body: 'b',
          state: 'open',
          labels: [],
          reactions: { '+1': 5, '-1': 1, hooray: 2 },
        })
      )
    );
    mockJudge.mockResolvedValueOnce({ verdict: 'pass', reasoning: 'ok' });
    await checkCostBenefit(
      pr({
        files: [{ path: 'a.ts', additions: 200, deletions: 0, status: 'modified' }],
        linkedIssues: [
          {
            owner: 'storybookjs',
            repo: 'storybook',
            number: 42,
            url: 'u',
            title: 'I',
            body: 'b',
            state: 'open',
            labels: ['sev:S2'],
          },
        ],
      })
    );
    expect(mockJudge).toHaveBeenCalledOnce();
    const prompt = mockJudge.mock.calls[0][0] as string;
    expect(prompt).toContain('sev:S2');
    expect(prompt).toContain('+5');
  });
});
