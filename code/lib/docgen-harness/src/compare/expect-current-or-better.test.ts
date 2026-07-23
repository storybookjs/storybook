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

  it('routes snippet input to the snippet comparator', () => {
    const baseline = '<sb-cmp [count]="3"></sb-cmp>';
    expect(() =>
      expectCurrentOrBetter({
        kind: 'snippet',
        framework: 'angular',
        args: { count: 3 },
        baseline,
        candidate: baseline,
      })
    ).not.toThrow();
    expect(() =>
      expectCurrentOrBetter({
        kind: 'snippet',
        framework: 'angular',
        args: { count: 3 },
        baseline,
        candidate: '<sb-cmp></sb-cmp>',
      })
    ).toThrow(/lost-representation.*count/s);
  });
});
