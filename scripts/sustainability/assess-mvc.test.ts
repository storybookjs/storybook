import { describe, expect, it } from 'vitest';

import { runAssessment } from './assess-mvc.ts';

const fakePr = {
  owner: 'storybookjs',
  repo: 'storybook',
  number: 1,
  url: 'u',
  title: 't',
  body: 'closes #2',
  author: 'someone',
  isDraft: false,
  headSha: 'sha',
  labels: ['agent-scan:human'],
  files: [],
};

const fakeIssue = {
  owner: 'storybookjs',
  repo: 'storybook',
  number: 2,
  url: 'u2',
  title: 'I',
  body: '',
  state: 'open' as const,
  labels: [],
};

describe('runAssessment (deterministic-only)', () => {
  it('PASSes deterministic phase, defers LLM checks, dry-run produces no writes', async () => {
    const writes: any[] = [];
    const result = await runAssessment({
      coords: { owner: 'storybookjs', repo: 'storybook', number: 1 },
      flags: {
        dryRun: true,
        dismissPrevious: false,
        skipInternalPrs: false,
        model: 'sonnet-4.6',
        effort: 'medium',
        verbose: false,
      },
      deps: {
        fetchPrContext: async () => ({
          ...fakePr,
          linkedIssues: [fakeIssue],
          brokenLinkRefs: [],
        }),
        duplicateLookup: async () => ({ crossRefs: [], timeline: [] }),
        isMaintainer: async () => false,
        llmJudge: async (id) => ({
          id,
          status: 'deferred' as const,
          evidence: 'LLM phase not wired in Phase 1',
        }),
        synthesizeReview: async () => 'placeholder review body',
        writes: {
          addLabels: async (l) => writes.push({ kind: 'add', l }),
          removeLabels: async (l) => writes.push({ kind: 'remove', l }),
          submitReview: async (r) => writes.push({ kind: 'review', r }),
          dismissPriorReviews: async () => writes.push({ kind: 'dismiss' }),
        },
      },
    });
    expect(result.verdict).toBe('pass');
    expect(writes).toEqual([]);
    expect(result.labelsToAdd).toContain('mvc:success');
    expect(result.prSummary.number).toBe(1);
  });
});
