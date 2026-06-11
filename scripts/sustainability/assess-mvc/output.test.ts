import { describe, expect, it } from 'vitest';

import { renderSummary } from './output.ts';

describe('renderSummary', () => {
  it('renders a header line and a row per check id', () => {
    const out = renderSummary({
      pr: { number: 12345, title: 'Fix vite externals', author: 'someone', url: 'u' },
      verdict: 'fail',
      results: [
        { id: 'human', status: 'pass', evidence: 'agent-scan:human' },
        { id: 'real-problem', status: 'deferred', evidence: 'LLM phase not run' },
        { id: 'duplicate', status: 'pass', evidence: 'no conflicts' },
        { id: 'cost-benefit', status: 'warn', evidence: '+482 LOC' },
        { id: 'explains-test', status: 'fail', evidence: 'empty section' },
        { id: 'provides-context', status: 'pass', evidence: 'substantive' },
      ],
      reviewBody: 'BODY',
      labelsToAdd: ['mvc:failed'],
      labelsToRemove: ['mvc:skip'],
      dryRun: true,
    });
    expect(out).toContain('#12345');
    expect(out).toContain('FAIL');
    expect(out).toContain('Human-monitored');
    expect(out).toContain('Real problem');
    expect(out).toContain('Not duplicate');
    expect(out).toContain('Cost/benefit');
    expect(out).toContain('Explains how to test');
    expect(out).toContain('Provides context');
    expect(out).toContain('BODY');
    expect(out).toContain('add:    mvc:failed');
    expect(out).toContain('remove: mvc:skip');
  });
});
