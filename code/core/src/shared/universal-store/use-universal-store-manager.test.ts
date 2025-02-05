// @vitest-environment happy-dom

/* eslint-disable no-underscore-dangle */
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
