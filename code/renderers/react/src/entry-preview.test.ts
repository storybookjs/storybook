import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEventWrapper } from './entry-preview.tsx';

describe('createEventWrapper', () => {
  let act: ReturnType<typeof vi.fn>;
  let shouldThrow = false;

  beforeEach(() => {
    shouldThrow = false;
    act = vi.fn((cb: () => void) => {
      if (shouldThrow) {
        shouldThrow = false;
        throw new Error('boom');
      }
      return cb();
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
});
