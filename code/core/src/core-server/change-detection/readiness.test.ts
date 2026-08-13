import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getChangeDetectionReadiness,
  resetChangeDetectionReadiness,
  setChangeDetectionHost,
  setChangeDetectionReadiness,
} from './readiness.ts';

describe('change-detection readiness host', () => {
  afterEach(() => {
    setChangeDetectionHost(undefined);
    resetChangeDetectionReadiness();
  });

  it('runs the host once on the first readiness read, then returns the published result', async () => {
    const host = vi.fn(async () => {
      setChangeDetectionReadiness({ status: 'ready' });
    });
    setChangeDetectionHost(host);

    await expect(getChangeDetectionReadiness()).resolves.toEqual({ status: 'ready' });
    await expect(getChangeDetectionReadiness()).resolves.toEqual({ status: 'ready' });
    expect(host).toHaveBeenCalledTimes(1);
  });

  it('runs the host once when two readiness reads overlap', async () => {
    const host = vi.fn(async () => {
      setChangeDetectionReadiness({ status: 'ready' });
    });
    setChangeDetectionHost(host);

    const [first, second] = await Promise.all([
      getChangeDetectionReadiness(),
      getChangeDetectionReadiness(),
    ]);
    expect(first).toEqual({ status: 'ready' });
    expect(second).toEqual({ status: 'ready' });
    expect(host).toHaveBeenCalledTimes(1);
  });
});
