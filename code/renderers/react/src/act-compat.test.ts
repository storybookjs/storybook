import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { createEventWrapper } from './act-compat.ts';

describe('createEventWrapper', () => {
  let act: Mock<(cb: () => unknown) => unknown>;
  let shouldReturnThenable = false;

  beforeEach(() => {
    shouldReturnThenable = false;
    act = vi.fn((cb: () => unknown) => {
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

  it('restores the wrapper state when the callback throws', () => {
    const wrapper = createEventWrapper(act);

    expect(() =>
      wrapper(() => {
        throw new Error('boom');
      })
    ).toThrow('boom');
    expect(() => wrapper(() => undefined)).not.toThrow();
    expect(act).toHaveBeenCalledTimes(2);
  });

  it('returns the callback result rather than the act thenable', () => {
    shouldReturnThenable = true;
    const wrapper = createEventWrapper(act);

    expect(wrapper(() => 'callback result')).toBe('callback result');
  });
});
