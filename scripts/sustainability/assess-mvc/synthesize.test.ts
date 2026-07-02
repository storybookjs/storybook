import { describe, expect, it } from 'vitest';

import { CHECK_TEMPLATES, OVERALL_TEMPLATES } from './canned-responses.ts';
import { MARKER, REVIEW_FOOTER } from './config.ts';
import { synthesizeReview } from './synthesize.ts';

describe('synthesizeReview', () => {
  it('wraps output with marker + footer, uses PASS framing when nothing failed', () => {
    const body = synthesizeReview({
      results: [{ id: 'human', status: 'pass', reasoning: 'ok' }],
      earlyAbort: false,
    });
    expect(body.startsWith(MARKER)).toBe(true);
    expect(body.endsWith(REVIEW_FOOTER)).toBe(true);
    expect(body).toContain(OVERALL_TEMPLATES.pass.intro);
    expect(body).toContain(OVERALL_TEMPLATES.pass.conclusion);
  });

  it('uses FAIL framing when any check fails', () => {
    const body = synthesizeReview({
      results: [
        { id: 'human', status: 'pass', reasoning: 'ok' },
        {
          id: 'real-problem',
          status: 'fail',
          reasoning: 'no linked issue',
          guidance: 'Link an open issue.',
          maintainerGuidance: 'Verify the linked issue exists.',
        },
      ],
      earlyAbort: false,
    });
    expect(body).toContain(OVERALL_TEMPLATES.fail.intro);
    expect(body).toContain(OVERALL_TEMPLATES.fail.conclusion);
  });

  it('renders each non-PASS check with its human title and populated slots', () => {
    const body = synthesizeReview({
      results: [
        {
          id: 'cost-benefit',
          status: 'fail',
          reasoning: 'huge diff for a tiny bug',
          guidance: 'Narrow the scope.',
          maintainerGuidance: 'Weigh diff vs. severity.',
        },
      ],
      earlyAbort: false,
    });
    expect(body).toContain(`### ${CHECK_TEMPLATES['cost-benefit'].title} — needs changes`);
    expect(body).toContain('huge diff for a tiny bug');
    expect(body).toContain('**For you as the PR author:** Narrow the scope.');
    expect(body).toContain('**For maintainers reviewing this PR:** Weigh diff vs. severity.');
  });

  it('omits the guidance label line when the check produced no author guidance', () => {
    const body = synthesizeReview({
      results: [
        {
          id: 'cost-benefit',
          status: 'warn',
          reasoning: 'borderline',
          maintainerGuidance: 'Consider WARN over FAIL.',
        },
      ],
      earlyAbort: false,
    });
    expect(body).toContain('borderline');
    expect(body).toContain('**For maintainers reviewing this PR:**');
    expect(body).not.toContain('**For you as the PR author:**');
  });

  it('omits both guidance labels when neither field is populated', () => {
    const body = synthesizeReview({
      results: [{ id: 'real-problem', status: 'fail', reasoning: 'no linked issue' }],
      earlyAbort: false,
    });
    expect(body).toContain('no linked issue');
    expect(body).not.toContain('**For you as the PR author:**');
    expect(body).not.toContain('**For maintainers reviewing this PR:**');
  });

  it('lists PASS check titles compactly at the end', () => {
    const body = synthesizeReview({
      results: [
        { id: 'human', status: 'pass', reasoning: '' },
        { id: 'duplicate', status: 'pass', reasoning: '' },
        {
          id: 'cost-benefit',
          status: 'fail',
          reasoning: 'too big',
          guidance: 'Narrow.',
          maintainerGuidance: 'Weigh.',
        },
      ],
      earlyAbort: false,
    });
    expect(body).toContain('### Checks that passed');
    expect(body).toContain(CHECK_TEMPLATES.human.title);
    expect(body).toContain(CHECK_TEMPLATES.duplicate.title);
  });

  it('renders sections in canonical order regardless of results order', () => {
    const body = synthesizeReview({
      results: [
        {
          id: 'provides-context',
          status: 'fail',
          reasoning: 'no why',
        },
        {
          id: 'real-problem',
          status: 'fail',
          reasoning: 'no linked issue',
        },
      ],
      earlyAbort: false,
    });
    const realProblemIdx = body.indexOf(CHECK_TEMPLATES['real-problem'].title);
    const providesContextIdx = body.indexOf(CHECK_TEMPLATES['provides-context'].title);
    expect(realProblemIdx).toBeGreaterThan(-1);
    expect(providesContextIdx).toBeGreaterThan(realProblemIdx);
  });

  it('surfaces deferred checks under a "not performed yet" section on early-abort', () => {
    const body = synthesizeReview({
      results: [
        { id: 'human', status: 'pass', reasoning: 'ok' },
        {
          id: 'duplicate',
          status: 'fail',
          reasoning: 'dupe of #1',
          guidance: 'Collaborate on the other PR.',
        },
        { id: 'real-problem', status: 'deferred', reasoning: 'skipped' },
        { id: 'cost-benefit', status: 'deferred', reasoning: 'skipped' },
      ],
      earlyAbort: true,
    });
    expect(body).toContain('### Checks not performed yet');
    expect(body).toContain(CHECK_TEMPLATES['real-problem'].title);
    expect(body).toContain(CHECK_TEMPLATES['cost-benefit'].title);
  });
});
