import { describe, expect, it } from 'vitest';

import type { StrictArgTypes } from '../../../../core/src/csf/story.ts';
import { expectCurrentOrBetter } from './expect-current-or-better.ts';

describe('expectCurrentOrBetter', () => {
  it('passes silently when there are no violations', () => {
    const identical: StrictArgTypes = {
      size: { name: 'size', type: { name: 'string' } },
    };
    expect(() =>
      expectCurrentOrBetter({ kind: 'argTypes', baseline: identical, candidate: identical })
    ).not.toThrow();
  });

  it('throws one error listing every violation', () => {
    const baseline: StrictArgTypes = {
      one: { name: 'one', type: { name: 'string' } },
      two: { name: 'two', description: 'Documented.' },
      three: { name: 'three', table: { defaultValue: { summary: '5' } } },
    };
    const candidate: StrictArgTypes = { two: { name: 'two' }, three: { name: 'three' } };
    let caught: Error | undefined;
    try {
      expectCurrentOrBetter({ kind: 'argTypes', baseline, candidate });
    } catch (error) {
      caught = error as Error;
    }
    expect(caught).toBeDefined();
    expect(caught!.message).toContain('3 violation(s)');
    expect(caught!.message).toContain('lost-arg');
    expect(caught!.message).toContain('lost-description');
    expect(caught!.message).toContain('lost-default');
  });

  it('threads legacyBaseline and strictTable through to the argTypes comparator', () => {
    const inventedDefault: StrictArgTypes = {
      count: { name: 'count', table: { defaultValue: { summary: false as unknown as string } } },
    };
    const noDefault: StrictArgTypes = { count: { name: 'count' } };
    expect(() =>
      expectCurrentOrBetter({ kind: 'argTypes', baseline: inventedDefault, candidate: noDefault })
    ).toThrow(/lost-default/);
    expect(() =>
      expectCurrentOrBetter({
        kind: 'argTypes',
        baseline: inventedDefault,
        candidate: noDefault,
        legacyBaseline: true,
      })
    ).not.toThrow();

    const summary = (text: string): StrictArgTypes => ({
      count: { name: 'count', table: { type: { summary: text } } },
    });
    expect(() =>
      expectCurrentOrBetter({
        kind: 'argTypes',
        baseline: summary('number'),
        candidate: summary('string'),
      })
    ).not.toThrow();
    expect(() =>
      expectCurrentOrBetter({
        kind: 'argTypes',
        baseline: summary('number'),
        candidate: summary('string'),
        strictTable: true,
      })
    ).toThrow(/changed-summary/);
  });

  it('accepts a declared lost default', () => {
    const baseline: StrictArgTypes = {
      rows: { name: 'rows', table: { defaultValue: { summary: 'Math.max(1, 3)' } } },
    };
    const withoutDefault: StrictArgTypes = { rows: { name: 'rows' } };

    expect(() =>
      expectCurrentOrBetter({
        kind: 'argTypes',
        baseline,
        candidate: withoutDefault,
        legacyBaseline: true,
        declaredDefaultOmissions: [{ arg: 'rows', expectedSummary: 'Math.max(1, 3)' }],
      })
    ).not.toThrow();
  });

  it('rejects a default omission outside a legacy gate or with a changed source summary', () => {
    const baseline: StrictArgTypes = {
      rows: { name: 'rows', table: { defaultValue: { summary: 'Math.max(1, 3)' } } },
    };
    const candidate: StrictArgTypes = { rows: { name: 'rows' } };
    const omission = [{ arg: 'rows', expectedSummary: 'Math.max(1, 3)' }] as const;

    expect(() =>
      // @ts-expect-error The runtime guard protects untyped callers of the comparator too.
      expectCurrentOrBetter({
        kind: 'argTypes',
        baseline,
        candidate,
        declaredDefaultOmissions: omission,
      })
    ).toThrow(/only waive legacy Angular baselines/);
    expect(() =>
      expectCurrentOrBetter({
        kind: 'argTypes',
        baseline,
        candidate,
        legacyBaseline: true,
        declaredDefaultOmissions: [{ arg: 'rows', expectedSummary: 'runtimeRows' }],
      })
    ).toThrow(/summaries changed for rows/);
  });

  it('rejects a stale declared default omission', () => {
    const withDefault: StrictArgTypes = {
      rows: { name: 'rows', table: { defaultValue: { summary: 'Math.max(1, 3)' } } },
    };

    expect(() =>
      expectCurrentOrBetter({
        kind: 'argTypes',
        baseline: withDefault,
        candidate: withDefault,
        legacyBaseline: true,
        declaredDefaultOmissions: [{ arg: 'rows', expectedSummary: 'Math.max(1, 3)' }],
      })
    ).toThrow(/now record defaults for rows/);
  });

  it('never lets a default omission suppress another violation for the same arg', () => {
    const baseline: StrictArgTypes = {
      loading: {
        name: 'loading',
        description: 'Whether data is loading.',
        table: { defaultValue: { summary: 'signal(false)' } },
      },
    };
    const candidate: StrictArgTypes = { loading: { name: 'loading' } };

    expect(() =>
      expectCurrentOrBetter({
        kind: 'argTypes',
        baseline,
        candidate,
        legacyBaseline: true,
        declaredDefaultOmissions: [{ arg: 'loading', expectedSummary: 'signal(false)' }],
      })
    ).toThrow(/lost-description.*loading/s);
  });

  it('reports an unparsable candidate instead of calling declared omissions stale', () => {
    expect(() =>
      expectCurrentOrBetter({
        kind: 'snippet',
        framework: 'vue3',
        baseline: '<template>\n  <C :severity="severity" />\n</template>',
        candidate: 'not a snippet',
        declaredOmissions: ['severity'],
      })
    ).toThrow(/unparsable-candidate/);
  });

  it('routes snippet input to the snippet comparator', () => {
    const baseline = '<sb-cmp [count]="3"></sb-cmp>';
    expect(() =>
      expectCurrentOrBetter({
        kind: 'snippet',
        framework: 'angular',
        baseline,
        candidate: baseline,
      })
    ).not.toThrow();
    expect(() =>
      expectCurrentOrBetter({
        kind: 'snippet',
        framework: 'angular',
        baseline,
        candidate: '<sb-cmp></sb-cmp>',
      })
    ).toThrow(/lost-representation.*count/s);
  });
});
