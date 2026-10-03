import { afterEach, describe, expect, it, vi } from 'vitest';

import { isReduceMotionEnabled } from './is-reduced-motion-enabled.ts';

describe('isReduceMotionEnabled', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('queries the reduced-motion media feature', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: false });
    vi.stubGlobal('matchMedia', matchMedia);

    isReduceMotionEnabled();

    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('is true when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));

    expect(isReduceMotionEnabled()).toBe(true);
  });

  it('is false when the user expresses no preference', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));

    expect(isReduceMotionEnabled()).toBe(false);
  });

  it('is false where matchMedia does not exist', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(isReduceMotionEnabled()).toBe(false);
  });
});
