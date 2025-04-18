import { describe, expect, it } from 'vitest';

import { splitSelectors } from './splitSelectors';

describe('splitSelectors', () => {
  it('handles basic selectors', () => {
    expect(splitSelectors('.a')).toEqual(['.a']);

    expect(splitSelectors('.a, .b')).toEqual(['.a', '.b']);
  });

  it('supports ::slotted and :is', () => {
    expect(splitSelectors('::slotted(:is(button, a):active)')).toEqual([
      '::slotted(:is(button, a):active)',
    ]);

    expect(
      splitSelectors('::slotted(:is(button, a):active), ::slotted(:is(button, a):hover)')
    ).toEqual(['::slotted(:is(button, a):active)', '::slotted(:is(button, a):hover)']);
  });

  it('supports :host', () => {
    expect(
      splitSelectors(
        ":host([type='secondary']) ::slotted(:is(button, a)), :host([type='primary']) ::slotted(:is(button, a):active)"
      )
    ).toEqual([
      ":host([type='secondary']) ::slotted(:is(button, a))",
      ":host([type='primary']) ::slotted(:is(button, a):active)",
    ]);

    expect(
      splitSelectors(
        ':host([outline]) ::slotted(:is(button, a):focus-within:focus-visible:not(:active))'
      )
    ).toEqual([
      ':host([outline]) ::slotted(:is(button, a):focus-within:focus-visible:not(:active))',
    ]);
  });
});
