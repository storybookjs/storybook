import { describe, expect, it, vi } from 'vitest';

import { createEventWrapper } from './entry-preview.tsx';

describe('createEventWrapper', () => {
  it('avoids nested act calls while already within an act scope', () => {
    const act = vi.fn((cb) => cb());
    const wrapper = createEventWrapper(act);
    const inner = vi.fn();

    wrapper(() => {
      wrapper(() => inner());
    });

    expect(act).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('restores the wrapper state when a callback throws', () => {
    let actCallCount = 0;
    const act = vi.fn((cb) => {
      actCallCount += 1;
      if (actCallCount === 1) {
        throw new Error('boom');
      }
      return cb();
    });
    const wrapper = createEventWrapper(act);

    expect(() => wrapper(() => undefined)).toThrow('boom');
    expect(() => wrapper(() => undefined)).not.toThrow();
    expect(act).toHaveBeenCalledTimes(2);
  });
});
