// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UniversalStore } from '.';
import { instances as mockedInstances } from './__mocks__/instances';
import type { ChannelEvent } from './types';
import { useUniversalStore as useUniversalStoreManager } from './use-universal-store-manager';

vi.mock('./instances');

const mockChannelListeners = new Map<string, Set<(...args: any[]) => void>>();

const mockChannel = {
  on: vi.fn((eventType: string, listener: (...args: any[]) => void) => {
    const [universalStorePrefix, environmentId, universalStoreId] = eventType.split(':');
    if (!mockChannelListeners.has(universalStoreId)) {
      mockChannelListeners.set(universalStoreId, new Set());
    }
    const listeners = mockChannelListeners.get(universalStoreId)!;
    listeners.add(listener);
  }),
  off: vi.fn((eventType: string, listener: (...args: any[]) => void) => {
    const universalStoreId = eventType.split(':')[2];
    if (!mockChannelListeners.has(universalStoreId)) {
      return;
    }
    const listeners = mockChannelListeners.get(universalStoreId)!;
    listeners.delete(listener);
  }),
  emit: vi.fn((eventType: string, channelEvent: ChannelEvent<any, any>) => {
    const [universalStorePrefix, environmentId, universalStoreId] = eventType.split(':');
    if (!mockChannelListeners.has(universalStoreId)) {
      return;
    }
    const listeners = mockChannelListeners.get(universalStoreId)!;
    setTimeout(() => {
      // this is a simplification, emulating that the event is emitted asynchronously
      // in reality, it would be synchronous within the same environment, but async across environments
      listeners.forEach((listener) => listener(channelEvent));
    }, 0);
  }),
};

describe('useUniversalStore - Manager', () => {
  beforeEach((context) => {
    vi.useRealTimers();
    let randomUUIDCounter = 0;
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => {
      return `mocked-random-uuid-v4-${randomUUIDCounter++}`;
    });

    // Always prepare the store, unless the test is specifically for unprepared state
    if (!context.task.name.toLowerCase().includes('unprepared')) {
      UniversalStore.__prepare(mockChannel, UniversalStore.Environment.MANAGER);
    }

    return () => {
      randomUUIDCounter = 0;
      mockedInstances.clearAllEnvironments();
      mockChannelListeners.clear();
      UniversalStore.__reset();
    };
  });

  it('should re-render when the state changes', async () => {
    // Arrange - create a store
    const store = UniversalStore.create({
      id: 'env1:test',
      leader: true,
      initialState: { count: 0 },
    });
    const renderCounter = vi.fn();

    // Act - render the hook
    const { result } = renderHook(() => {
      renderCounter();
      return useUniversalStoreManager(store);
    });

    // Assert - the component should render with the initial state
    expect(renderCounter).toHaveBeenCalledTimes(1);
    const [firstState] = result.current;
    expect(firstState).toEqual({ count: 0 });

    // Act - set the state directly on the store
    act(() => store.setState({ count: 1 }));

    // Assert - the component should re-render with the new state
    expect(renderCounter).toHaveBeenCalledTimes(2);
    const [secondState] = result.current;
    expect(secondState).toEqual({ count: 1 });
  });

  it('should only re-render when the selected state changes', async () => {
    // Arrange - create a store
    const store = UniversalStore.create({
      id: 'env1:test',
      leader: true,
      initialState: { count: 0, selectedCount: 10 },
    });
    const renderCounter = vi.fn();

    // Act - render the hook with a selector
    const { result } = renderHook(() => {
      renderCounter();
      return useUniversalStoreManager(store, (state) => state.selectedCount);
    });

    // Assert - the component should re-render when the state changes
    expect(renderCounter).toHaveBeenCalledTimes(1);
    const [firstState] = result.current;
    expect(firstState).toEqual(10);

    // Act - set the selected state
    act(() => store.setState({ count: 1, selectedCount: 20 }));

    // Assert - the component should re-render with the new selected state
    expect(renderCounter).toHaveBeenCalledTimes(2);
    const [secondState] = result.current;
    expect(secondState).toEqual(20);

    // Act - set the unselected state
    act(() => store.setState({ count: 5, selectedCount: 20 }));

    // Assert - the component should not re-render because the selected state didn't change
    expect(renderCounter).toHaveBeenCalledTimes(2);
    const [thirdState] = result.current;
    expect(thirdState).toEqual(20);
  });

  it('should re-render when the selector changes', () => {
    // Arrange - create a store
    const store = UniversalStore.create({
      id: 'env1:test',
      leader: true,
      initialState: { count: 0, selectedCount: 10, otherValue: 5 },
    });
    const renderCounter = vi.fn();

    // Initial render with a selector for selectedCount
    const { result, rerender } = renderHook(
      ({ selector }) => {
        renderCounter();
        return useUniversalStoreManager(store, selector);
      },
      { initialProps: { selector: (state: any) => state.selectedCount } }
    );

    // Assert - initial render
    expect(renderCounter).toHaveBeenCalledTimes(1);
    const [firstState] = result.current;
    expect(firstState).toEqual(10);

    // Act - change the selector to a different property
    rerender({ selector: (state: any) => state.otherValue });

    // Assert - should re-render with the new selected state
    expect(renderCounter).toHaveBeenCalledTimes(2);
    const [secondState] = result.current;
    expect(secondState).toEqual(5);

    // Act - update the store state
    act(() => store.setState({ count: 1, selectedCount: 10, otherValue: 15 }));

    // Assert - should re-render because the newly selected state changed
    expect(renderCounter).toHaveBeenCalledTimes(3);
    const [thirdState] = result.current;
    expect(thirdState).toEqual(15);
  });

  it('should re-render when the universalStore changes', () => {
    // Arrange - create initial store
    const initialStore = UniversalStore.create({
      id: 'env1:test1',
      leader: true,
      initialState: { count: 0, selectedCount: 10 },
    });
    const renderCounter = vi.fn();

    // Initial render with the first store
    const { result, rerender } = renderHook(
      ({ store }) => {
        renderCounter();
        return useUniversalStoreManager(store);
      },
      { initialProps: { store: initialStore } }
    );

    // Assert - initial render
    expect(renderCounter).toHaveBeenCalledTimes(1);
    const [firstState] = result.current;
    expect(firstState).toEqual({ count: 0, selectedCount: 10 });

    // Act - create a new store and rerender with it
    const newStore = UniversalStore.create({
      id: 'env1:test2',
      leader: true,
      initialState: { count: 5, selectedCount: 20 },
    });
    rerender({ store: newStore });

    // Assert - should re-render with the new store's state
    expect(renderCounter).toHaveBeenCalledTimes(2);
    const [secondState] = result.current;
    expect(secondState).toEqual({ count: 5, selectedCount: 20 });

    // Act - update the new store's state
    act(() => newStore.setState({ count: 10, selectedCount: 30 }));

    // Assert - should re-render with the updated state
    expect(renderCounter).toHaveBeenCalledTimes(3);
    const [thirdState] = result.current;
    expect(thirdState).toEqual({ count: 10, selectedCount: 30 });

    // Act - update the old store's state (should have no effect)
    act(() => initialStore.setState({ count: 100, selectedCount: 100 }));

    // Assert - should not re-render as we're no longer using the initial store
    expect(renderCounter).toHaveBeenCalledTimes(3);
    const [fourthState] = result.current;
    expect(fourthState).toEqual({ count: 10, selectedCount: 30 });
  });

  it('should set the state when the setter is called', () => {
    // Arrange - create a store and render the hook
    const store = UniversalStore.create({
      id: 'env1:test',
      leader: true,
      initialState: { count: 0 },
    });
    const renderCounter = vi.fn();
    const { result } = renderHook(() => {
      renderCounter();
      return useUniversalStoreManager(store);
    });

    // Act - set the state via the hook setter
    const [, firstSetState] = result.current;
    act(() => firstSetState({ count: 1 }));

    // Assert - the component should re-render with the new state
    expect(renderCounter).toHaveBeenCalledTimes(2);
    const [secondState] = result.current;
    expect(secondState).toEqual({ count: 1 });
  });
});
