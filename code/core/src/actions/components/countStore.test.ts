import { afterEach, describe, expect, it, vi } from 'vitest';

import { countStore } from './countStore.ts';

describe('countStore', () => {
  afterEach(() => {
    countStore.setState(0);
  });

  it('publishes a new count to its subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = countStore.subscribe(listener);

    countStore.setState(1);
    countStore.setState(2);

    expect(countStore.getState()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('keeps the count for a subscriber that arrives later', () => {
    countStore.setState(3);

    const listener = vi.fn();
    const unsubscribe = countStore.subscribe(listener);

    expect(countStore.getState()).toBe(3);
    unsubscribe();
  });

  it('stays quiet for an equal count and for an unsubscribed listener', () => {
    const listener = vi.fn();
    const unsubscribe = countStore.subscribe(listener);

    countStore.setState(0);
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
    countStore.setState(1);
    expect(listener).not.toHaveBeenCalled();
  });
});
