import { describe, expect, it, vi } from 'vitest';

import { StorybookInstanceUnavailableError } from '@storybook/core/internal/server-errors';

import {
  createTestInstanceContext,
  runInTestInstance,
} from '../../shared/instance-context.test-helpers.ts';
import {
  getChangeDetectionReadiness,
  setChangeDetectionHost,
  setChangeDetectionReadiness,
} from './readiness.ts';

describe('change-detection readiness host', () => {
  it('runs the host once on the first readiness read, then returns the published result', () =>
    runInTestInstance(async () => {
      const host = vi.fn(async () => {
        setChangeDetectionReadiness({ status: 'ready' });
      });
      setChangeDetectionHost(host);

      await expect(getChangeDetectionReadiness()).resolves.toEqual({ status: 'ready' });
      await expect(getChangeDetectionReadiness()).resolves.toEqual({ status: 'ready' });
      expect(host).toHaveBeenCalledTimes(1);
    }));

  it('converts a rejecting host into an error readiness result', () =>
    runInTestInstance(async () => {
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
    }));

  it('runs the host once when two readiness reads overlap', () =>
    runInTestInstance(async () => {
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
    }));

  it('keeps each instance readiness apart', async () => {
    const first = createTestInstanceContext();
    const second = createTestInstanceContext();

    await runInTestInstance(() => setChangeDetectionReadiness({ status: 'ready' }), first);
    await runInTestInstance(
      () => setChangeDetectionReadiness({ status: 'unavailable', reason: 'no git' }),
      second
    );

    await expect(runInTestInstance(getChangeDetectionReadiness, first)).resolves.toEqual({
      status: 'ready',
    });
    await expect(runInTestInstance(getChangeDetectionReadiness, second)).resolves.toEqual({
      status: 'unavailable',
      reason: 'no git',
    });
  });

  it('throws outside an instance', () => {
    expect(() => setChangeDetectionReadiness({ status: 'ready' })).toThrow(
      StorybookInstanceUnavailableError
    );
  });
});
