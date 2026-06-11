import { describe, expect, it } from 'vitest';

import { setupMsw } from '../utils/test-helpers/msw.ts';
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
  setupMsw();

  it('PASSes when both deterministic checks pass and no linked issues', async () => {
    const result = await runAssessment(basePr, {
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
  });

  it('FAILs and early-aborts when human check fails', async () => {
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
    const llm = result.results.filter((r) =>
      ['real-problem', 'cost-benefit', 'explains-test', 'provides-context'].includes(r.id)
    );
    expect(llm.every((r) => r.status === 'deferred')).toBe(true);
    expect(result.labelsToAdd).toContain('mvc:failed');
  });
});
