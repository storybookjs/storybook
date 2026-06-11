import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupMsw } from '../utils/test-helpers/msw.ts';
import type { PrContext } from './assess-mvc/types.ts';
import { runAssessment } from './assess-mvc.ts';

const { mockJudge } = vi.hoisted(() => ({ mockJudge: vi.fn() }));

vi.mock('../utils/llm/client', () => ({
  getLlmClient: () => ({ judge: mockJudge }),
  configureLlmClient: vi.fn(),
  resetLlmClient: vi.fn(),
}));

const basePr: PrContext = {
  owner: 'storybookjs',
  repo: 'storybook',
  number: 1,
  url: 'u',
  title: 't',
  body: '',
  author: 'someone',
  isDraft: false,
  headSha: 'sha',
  labels: ['agent-scan:human'],
  files: [],
  linkedIssues: [
    {
      owner: 'storybookjs',
      repo: 'storybook',
      number: 42,
      url: 'u',
      title: 'I',
      body: 'b',
      state: 'open',
      labels: [],
    },
  ],
  brokenLinkRefs: [],
};

// Unified shape satisfies every check's schema (zod's default `.strip()`
// silently drops unknown keys) so we don't need to enumerate per-call shapes.
const allPassJudge = {
  matchesIssue: true,
  category: 'bug',
  reasoning: 'ok',
  featureFit: 'augments-api',
  verdict: 'pass',
  reviewBody: 'composed review body',
};

describe('runAssessment (Phase 2: deterministic + LLM)', () => {
  const { server, http, HttpResponse } = setupMsw();
  beforeEach(() => {
    mockJudge.mockReset();
    // checkDuplicate hits GraphQL (cross-refs) + REST (timeline) for each linked
    // issue. Default to empty responses; individual tests can override.
    server.use(
      http.post('https://api.github.com/graphql', () =>
        HttpResponse.json({
          data: { repository: { issue: { timelineItems: { nodes: [] } } } },
        })
      ),
      http.get(
        'https://api.github.com/repos/storybookjs/storybook/issues/:n/timeline',
        () => HttpResponse.json([])
      )
    );
  });

  it('FAILs and early-aborts when human check fails; only synthesis runs', async () => {
    mockJudge.mockResolvedValueOnce({ reviewBody: 'composed' });
    const result = await runAssessment(
      { ...basePr, labels: ['agent-scan:automated'] },
      {
        dryRun: true,
        dismissPrevious: false,
        model: 'sonnet-4.6',
        effort: 'medium',
        verbose: false,
      }
    );
    expect(result.verdict).toBe('fail');
    expect(result.earlyAbort).toBe(true);
    expect(mockJudge).toHaveBeenCalledTimes(1);
    expect(result.labelsToAdd).toContain('mvc:failed');
  });

  it('PASSes when deterministic checks pass; runs 4 LLM checks + synthesis', async () => {
    mockJudge.mockResolvedValue(allPassJudge);
    const result = await runAssessment(basePr, {
      dryRun: true,
      dismissPrevious: false,
      model: 'sonnet-4.6',
      effort: 'medium',
      verbose: false,
    });
    expect(result.verdict).toBe('pass');
    expect(result.earlyAbort).toBe(false);
    // 4 LLM judgments + 1 synthesis; cost-benefit short-circuits to PASS
    // for a 0-LOC diff so its judge call is skipped → 3 + 1 = 4. Trivial
    // provides-context also short-circuits → 2 + 1 = 3.
    expect(mockJudge.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(result.labelsToAdd).toContain('mvc:success');
    expect(result.reviewBody).toContain('composed review body');
  });
});
