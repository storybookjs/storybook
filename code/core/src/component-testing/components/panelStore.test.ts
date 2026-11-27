import { describe, expect, it, vi } from 'vitest';

import { createPanelStore } from './panelStore.ts';

describe('createPanelStore', () => {
  it('publishes a changed state to subscribers', () => {
    const store = createPanelStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setState({ count: 1 });

    expect(store.getState()).toEqual({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('applies an updater to the current state', () => {
    const store = createPanelStore({ count: 1 });

    store.setState((state) => ({ count: state.count + 1 }));

    expect(store.getState()).toEqual({ count: 2 });
  });

  it('keeps the current state and stays quiet for an equal state', () => {
    const toggle = () => {};
    const store = createPanelStore({ items: [{ id: 'a', toggle }] });
    const before = store.getState();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setState({ items: [{ id: 'a', toggle }] });

    expect(store.getState()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying an unsubscribed listener', () => {
    const store = createPanelStore({ count: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.setState({ count: 1 });

    expect(listener).not.toHaveBeenCalled();
  });
});
