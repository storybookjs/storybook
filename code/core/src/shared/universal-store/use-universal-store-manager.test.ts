// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MockUniversalStore } from './mock.ts';
import { useUniversalStore as useUniversalStoreManager } from './use-universal-store-manager.ts';

describe('useUniversalStore - Manager', () => {
  it('should re-render when the state changes', async () => {
    // Arrange - create a store
    const store = new MockUniversalStore({
      id: 'env1:test',
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

  it('should not re-render when the state is replaced with a deeply equal state', async () => {
    // Arrange - create a store
    const store = new MockUniversalStore({
      id: 'env1:test',
      initialState: { count: 0 },
    });
    const renderCounter = vi.fn();

    // Act - render the hook
    const { result } = renderHook(() => {
      renderCounter();
      return useUniversalStoreManager(store);
    });
    const [firstState] = result.current;

    // Act - replace the state with a new object of identical content
    act(() => store.setState({ count: 0 }));

    // Assert - the component should not re-render and the state should keep its identity
    expect(renderCounter).toHaveBeenCalledTimes(1);
    expect(result.current[0]).toBe(firstState);
  });

  it('should only re-render when the selected state changes', async () => {
    // Arrange - create a store
    const store = new MockUniversalStore({
      id: 'env1:test',
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
    const store = new MockUniversalStore({
      id: 'env1:test',
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
    const initialStore = new MockUniversalStore({
      id: 'env1:test1',
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
    const newStore = new MockUniversalStore({
      id: 'env1:test2',
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
    const store = new MockUniversalStore({
      id: 'env1:test',
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
