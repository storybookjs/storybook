import { describe, expect, it } from 'vitest';

import { stringifyArgs } from './stringifyArgs.tsx';

describe('stringifyArgs', () => {
  it('serializes plain args', () => {
    expect(stringifyArgs({ a: 1, b: 'two', c: { d: true } })).toBe(
      JSON.stringify({ a: 1, b: 'two', c: { d: true } })
    );
  });

  it('replaces functions with a marker', () => {
    expect(stringifyArgs({ onClick: () => {} })).toBe('{"onClick":"__sb_empty_function_arg__"}');
  });

  it('does not throw on a circular arg (e.g. a Vue VNode: el -> __vnode -> el)', () => {
    const el: { __vnode?: { type: string; el: typeof el } } = {};
    const vnode = { type: 'p', el };
    el.__vnode = vnode;

    expect(() => stringifyArgs({ footer: vnode })).not.toThrow();
    expect(stringifyArgs({ footer: vnode })).toContain('[Circular]');
  });
});
