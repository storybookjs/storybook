import { describe, expect, it, vi } from 'vitest';

import { useStore } from './utils';

describe('useStore', () => {
  it('should return the initial value', () => {
    const { get } = useStore(1);
    expect(get()).toBe(1);
  });

  it('should update the value', () => {
    const { get, set } = useStore(1);
    set(2);
    expect(get()).toBe(2);
  });

  it('should update the value using a function', () => {
    const { get, set } = useStore(1);
    set((value) => value + 1);
    expect(get()).toBe(2);
  });

  it('should subscribe and unsubscribe from the store', () => {
    const { set, subscribe } = useStore(1);
    const callback = vi.fn();

    const unsubscribe = subscribe(callback);
    set(2);
    expect(callback).toHaveBeenCalledWith(2);

    unsubscribe();
    set(3);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should invoke listener teardowns', () => {
    const { set, subscribe } = useStore();
    const callback = vi.fn();
    subscribe(() => callback);
    set(1);
    expect(callback).toHaveBeenCalledTimes(0);
    set(2);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should teardown the store', () => {
    const { get, teardown } = useStore(1);
    teardown();
    expect(get()).toBeUndefined();
  });
});
