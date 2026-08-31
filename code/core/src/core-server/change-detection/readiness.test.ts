import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../shared/open-service/service-registry.ts', { spy: true });

import { getService, isDelegatedMode } from '../../shared/open-service/service-registry.ts';

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

  it('converts a rejecting host into an error readiness result', async () => {
    setChangeDetectionHost(async () => {
      throw new Error('status store unavailable');
    });

    await expect(getChangeDetectionReadiness()).resolves.toEqual({
      status: 'error',
      error: expect.objectContaining({ message: 'status store unavailable' }),
    });
    await expect(getChangeDetectionReadiness()).resolves.toEqual({
      status: 'error',
      error: expect.objectContaining({ message: 'status store unavailable' }),
    });
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

describe('delegated change-detection readiness', () => {
  const getReadiness = vi.fn();

  beforeEach(() => {
    getReadiness.mockReset();
    getReadiness.mockResolvedValue({ status: 'ready' });
    vi.mocked(isDelegatedMode).mockReturnValue(true);
    vi.mocked(getService).mockReturnValue({
      commands: {
        _waitForChangeDetectionReadiness: getReadiness,
      },
    } as never);
  });

  afterEach(() => {
    setChangeDetectionHost(undefined);
    resetChangeDetectionReadiness();
    vi.mocked(isDelegatedMode).mockReset();
    vi.mocked(getService).mockReset();
  });

  it('asks the instance instead of waiting on the local deferred', async () => {
    await expect(getChangeDetectionReadiness()).resolves.toEqual({ status: 'ready' });
    expect(getReadiness).toHaveBeenCalledWith(undefined);
  });

  it('reconstructs an error result from the instance', async () => {
    getReadiness.mockResolvedValue({
      status: 'error',
      error: { message: 'scan blew up' },
    });

    await expect(getChangeDetectionReadiness()).resolves.toEqual({
      status: 'error',
      error: expect.objectContaining({ message: 'scan blew up' }),
    });
  });

  it('returns already-published local readiness without calling the instance', async () => {
    setChangeDetectionReadiness({ status: 'unavailable', reason: 'disabled' });

    await expect(getChangeDetectionReadiness()).resolves.toEqual({
      status: 'unavailable',
      reason: 'disabled',
    });
    expect(getReadiness).not.toHaveBeenCalled();
  });
});
