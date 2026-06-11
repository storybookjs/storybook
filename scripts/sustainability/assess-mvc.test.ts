import { describe, expect, it, vi } from 'vitest';

import type { PrContext } from './assess-mvc/types.ts';
import { runAssessment } from './assess-mvc.ts';

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
  linkedIssues: [],
  brokenLinkRefs: [],
};

describe('runAssessment (Phase 1: deterministic + LLM stubs)', () => {
  it('PASSes when both deterministic checks pass and no linked issues', async () => {
    const client = { graphql: vi.fn(), rest: vi.fn() } as any;
    const result = await runAssessment(basePr, {
      client,
      dryRun: true,
      dismissPrevious: false,
      model: 'sonnet-4.6',
      effort: 'medium',
      verbose: false,
    });
    expect(result.verdict).toBe('pass');
    expect(result.earlyAbort).toBe(false);
    expect(result.labelsToAdd).toContain('mvc:success');
    expect(result.prSummary.number).toBe(1);
    expect(client.graphql).not.toHaveBeenCalled();
    expect(client.rest).not.toHaveBeenCalled();
  });

  it('FAILs and early-aborts when human check fails', async () => {
    const client = { graphql: vi.fn(), rest: vi.fn() } as any;
    const result = await runAssessment(
      { ...basePr, labels: ['agent-scan:automated'] },
      {
        client,
        dryRun: true,
        dismissPrevious: false,
        model: 'sonnet-4.6',
        effort: 'medium',
        verbose: false,
      }
    );
    expect(result.verdict).toBe('fail');
    expect(result.earlyAbort).toBe(true);
    const llm = result.results.filter((r) =>
      ['real-problem', 'cost-benefit', 'explains-test', 'provides-context'].includes(r.id)
    );
    expect(llm.every((r) => r.status === 'deferred')).toBe(true);
    expect(result.labelsToAdd).toContain('mvc:failed');
  });

  it('queries github for linked-issue cross-refs when linked issues are present', async () => {
    const graphql = vi.fn().mockResolvedValue({
      repository: { issue: { timelineItems: { nodes: [] } } },
    });
    const rest = vi.fn(async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/issues/{issue_number}/timeline') {
        return { data: [] };
      }
      throw new Error(`unexpected ${route}`);
    });
    const client = { graphql, rest } as any;
    await runAssessment(
      {
        ...basePr,
        linkedIssues: [
          {
            owner: 'storybookjs',
            repo: 'storybook',
            number: 99,
            url: 'u',
            title: 'I',
            body: '',
            state: 'open',
            labels: [],
          },
        ],
      },
      {
        client,
        dryRun: true,
        dismissPrevious: false,
        model: 'sonnet-4.6',
        effort: 'medium',
        verbose: false,
      }
    );
    expect(graphql).toHaveBeenCalledOnce();
    expect(rest).toHaveBeenCalledOnce();
  });
});
