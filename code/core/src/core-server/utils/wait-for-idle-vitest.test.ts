import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../stores/test-provider.ts', () => ({
  fullTestProviderStore: {
    getFullState: vi.fn(),
  },
}));

import { fullTestProviderStore } from '../stores/test-provider.ts';
import { waitForIdleVitest } from './wait-for-idle-vitest.ts';

const getFullState = vi.mocked(fullTestProviderStore.getFullState);

beforeEach(() => {
  vi.useFakeTimers();
  getFullState.mockReset();
});

describe('waitForIdleVitest', () => {
  it('returns true immediately when no providers are running', async () => {
    getFullState.mockReturnValue({ a: 'test-provider-state:pending' });
    await expect(waitForIdleVitest()).resolves.toBe(true);
  });

  it('returns true immediately when state is empty', async () => {
    getFullState.mockReturnValue({});
    await expect(waitForIdleVitest()).resolves.toBe(true);
  });

  it('returns true when getFullState throws (store not initialized)', async () => {
    getFullState.mockImplementation(() => {
      throw new Error('not initialized');
    });
    await expect(waitForIdleVitest()).resolves.toBe(true);
  });

  it('waits and returns true when provider transitions from running to succeeded', async () => {
    getFullState
      .mockReturnValueOnce({ a: 'test-provider-state:running' })
      .mockReturnValueOnce({ a: 'test-provider-state:succeeded' });

    const promise = waitForIdleVitest(60_000, 100);

    // First poll finds running, schedules a timeout
    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toBe(true);
    expect(getFullState).toHaveBeenCalledTimes(2);
  });

  it('waits and returns true when provider transitions from running to crashed', async () => {
    getFullState
      .mockReturnValueOnce({ a: 'test-provider-state:running' })
      .mockReturnValueOnce({ a: 'test-provider-state:crashed' });

    const promise = waitForIdleVitest(60_000, 100);

    // First poll finds running, schedules a timeout
    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toBe(true);
    expect(getFullState).toHaveBeenCalledTimes(2);
  });

  it('returns false when maxWaitMs is exceeded', async () => {
    getFullState.mockReturnValue({ a: 'test-provider-state:running' });

    const promise = waitForIdleVitest(250, 100);

    // Advance past the deadline
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toBe(false);
  });

  it('treats multiple providers correctly — running if any is running', async () => {
    getFullState.mockReturnValue({
      a: 'test-provider-state:pending',
      b: 'test-provider-state:running',
    });

    const promise = waitForIdleVitest(50, 100);
    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toBe(false);
  });

  it('returns true when all multiple providers are idle', async () => {
    getFullState.mockReturnValue({
      a: 'test-provider-state:pending',
      b: 'test-provider-state:pending',
    });
    await expect(waitForIdleVitest()).resolves.toBe(true);
  });

  it('polls at the configured interval', async () => {
    getFullState
      .mockReturnValueOnce({ a: 'test-provider-state:running' })
      .mockReturnValueOnce({ a: 'test-provider-state:running' })
      .mockReturnValueOnce({ a: 'test-provider-state:pending' });

    const promise = waitForIdleVitest(60_000, 200);

    await vi.advanceTimersByTimeAsync(200);
    expect(getFullState).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(200);
    expect(getFullState).toHaveBeenCalledTimes(3);

    await expect(promise).resolves.toBe(true);
  });
});
