import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEventWrapper } from './act-compat.ts';

describe('createEventWrapper', () => {
  let act: ReturnType<typeof vi.fn>;
  let shouldThrow = false;
  let shouldReturnThenable = false;

  beforeEach(() => {
    shouldThrow = false;
    shouldReturnThenable = false;
    act = vi.fn((cb: () => unknown) => {
      if (shouldThrow) {
        shouldThrow = false;
        throw new Error('boom');
      }
      const result = cb();
      return shouldReturnThenable ? { then: () => undefined } : result;
    });
  });

  it('avoids nested act calls while already within an act scope', () => {
    const wrapper = createEventWrapper(act);
    const inner = vi.fn();

    wrapper(() => {
      wrapper(() => inner());
    });

    expect(act).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('restores the wrapper state when a callback throws', () => {
    shouldThrow = true;
    const wrapper = createEventWrapper(act);

    expect(() => wrapper(() => undefined)).toThrow('boom');
    expect(() => wrapper(() => undefined)).not.toThrow();
    expect(act).toHaveBeenCalledTimes(2);
  });
  it('returns the callback result rather than the act thenable', () => {
    shouldReturnThenable = true;
    const wrapper = createEventWrapper(act);

    expect(wrapper(() => 'callback result')).toBe('callback result');
  });

});
