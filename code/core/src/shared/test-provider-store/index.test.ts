// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MockUniversalStore } from '../universal-store/mock';
import { useUniversalStore } from '../universal-store/use-universal-store-manager';
import {
  type TestProviderStateByProviderId,
  type TestProviderStoreEvent,
  createTestProviderStore,
} from './index';
import { UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS } from './index';

const initialState: TestProviderStateByProviderId = {
  'provider-1': 'test-provider-state:running',
  'provider-2': 'test-provider-state:succeeded',
};

describe('testProviderStore', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fullTestProviderStore', () => {
    describe('getState', () => {
      it('should return all provider states', () => {
        // Arrange - create test provider store with initial state
        const { fullTestProviderStore } = createTestProviderStore({
          universalTestProviderStore: new MockUniversalStore<
            TestProviderStateByProviderId,
            TestProviderStoreEvent
          >({
            ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
            initialState,
          }),
        });

        // Act - get full state
        const result = fullTestProviderStore.getFullState();

        // Assert - verify state matches initial state
        expect(result).toEqual(initialState);
      });
    });

    describe('setState', () => {
      it('should set state', () => {
        // Arrange - create test provider store with initial state
        const { fullTestProviderStore } = createTestProviderStore({
          universalTestProviderStore: new MockUniversalStore<
            TestProviderStateByProviderId,
            TestProviderStoreEvent
          >({
            ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
            initialState,
          }),
        });

        // Act - set new provider state and get updated state
        fullTestProviderStore.setFullState((currentState) => ({
          ...currentState,
          'provider-3': 'test-provider-state:crashed',
        }));
        const result = fullTestProviderStore.getFullState();

        // Assert - verify new provider was added with correct state
        expect(result).toEqual({
          'provider-1': 'test-provider-state:running',
          'provider-2': 'test-provider-state:succeeded',
          'provider-3': 'test-provider-state:crashed',
        });
      });
    });
  });

  describe('getTestProviderStoreById', () => {
    describe('getState', () => {
      it('should initially return pending state for new provider', () => {
        // Arrange - create empty test provider store
        const { getTestProviderStoreById } = createTestProviderStore({
          universalTestProviderStore: new MockUniversalStore<
            TestProviderStateByProviderId,
            TestProviderStoreEvent
          >(UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS),
        });

        // Act - get store for new provider
        const store = getTestProviderStoreById('provider-1');

        // Assert - verify initial state is pending
        expect(store.getState()).toBe('test-provider-state:pending');
      });

      it('should return current state for existing provider', () => {
        // Arrange - create store with existing provider state
        const { getTestProviderStoreById } = createTestProviderStore({
          universalTestProviderStore: new MockUniversalStore<
            TestProviderStateByProviderId,
            TestProviderStoreEvent
          >({
            ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
            initialState: { 'provider-1': 'test-provider-state:running' },
          }),
        });

        // Act - get store for existing provider
        const store = getTestProviderStoreById('provider-1');

        // Assert - verify state matches initial state
        expect(store.getState()).toBe('test-provider-state:running');
      });
    });

    describe('setState', () => {
      it('should set state for the provider', async () => {
        // Arrange - create store with initial state
        const { getTestProviderStoreById, fullTestProviderStore } = createTestProviderStore({
          universalTestProviderStore: new MockUniversalStore<
            TestProviderStateByProviderId,
            TestProviderStoreEvent
          >({
            ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
            initialState,
          }),
        });

        // Act - set provider state to crashed
        const store = getTestProviderStoreById('provider-1');
        store.setState('test-provider-state:crashed');

        // Assert - verify provider state was updated
        await vi.waitFor(() => {
          expect(store.getState()).toBe('test-provider-state:crashed');
        });

        // Assert - verify only this provider's state changed in full state
        const fullState = fullTestProviderStore.getFullState();
        expect(fullState).toEqual({
          'provider-1': 'test-provider-state:crashed',
          'provider-2': 'test-provider-state:succeeded',
        });
      });
    });

    describe('runWithState', () => {
      it('should update state during execution flow', async () => {
        // Arrange - create store and setup success callback
        const { getTestProviderStoreById } = createTestProviderStore({
          universalTestProviderStore: new MockUniversalStore<
            TestProviderStateByProviderId,
            TestProviderStoreEvent
          >(UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS),
        });

        let runningGate: () => void;
        const gatedSuccessCallback = vi.fn(
          () =>
            new Promise<void>((resolve) => {
              runningGate = resolve;
            })
        );

        const store = getTestProviderStoreById('provider-1');

        // Act - start execution
        store.runWithState(gatedSuccessCallback);

        // Assert - verify running state
        await vi.waitFor(() => {
          expect(store.getState()).toBe('test-provider-state:running');
        });

        // Act - complete execution
        runningGate!();

        // Assert - verify success state
        await vi.waitFor(() => {
          expect(store.getState()).toBe('test-provider-state:succeeded');
        });
      });

      it('should handle errors and update state to crashed', async () => {
        // Arrange - create store and setup error callback
        const { getTestProviderStoreById } = createTestProviderStore({
          universalTestProviderStore: new MockUniversalStore<
            TestProviderStateByProviderId,
            TestProviderStoreEvent
          >(UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS),
        });

        let runningGate: () => void;
        const gatedErrorCallback = vi.fn(
          () =>
            new Promise<void>((resolve, reject) => {
              runningGate = reject;
            })
        );

        const store = getTestProviderStoreById('provider-1');

        // Act - start execution
        store.runWithState(gatedErrorCallback);

        // Assert - verify running state
        await vi.waitFor(() => {
          expect(store.getState()).toBe('test-provider-state:running');
        });

        // Act - trigger error
        runningGate!();

        // Assert - verify error state
        await vi.waitFor(() => {
          expect(store.getState()).toBe('test-provider-state:crashed');
        });
      });
    });

    describe('onRunAll', () => {
      it('should register and call listener when runAll is triggered', async () => {
        // Arrange - create store and setup listener
        const mockUniversalStore = new MockUniversalStore<
          TestProviderStateByProviderId,
          TestProviderStoreEvent
        >({
          ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
          initialState,
        });

        const { getTestProviderStoreById, fullTestProviderStore } = createTestProviderStore({
          universalTestProviderStore: mockUniversalStore,
        });

        const store = getTestProviderStoreById('provider-1');
        const listener = vi.fn();

        // Act - register listener and trigger runAll
        const unsubscribe = store.onRunAll(listener);
        fullTestProviderStore.runAll();

        // Assert - verify listener was called
        await vi.waitFor(() => {
          expect(listener).toHaveBeenCalledTimes(1);
        });

        // Act - unsubscribe and trigger again
        unsubscribe();
        fullTestProviderStore.runAll();

        // Assert - verify listener was not called after unsubscribe
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    describe('onClearAll', () => {
      it('should register and call listener when clearAll is triggered', async () => {
        // Arrange - create store and setup listener
        const mockUniversalStore = new MockUniversalStore<
          TestProviderStateByProviderId,
          TestProviderStoreEvent
        >({
          ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
          initialState,
        });

        const { getTestProviderStoreById, fullTestProviderStore } = createTestProviderStore({
          universalTestProviderStore: mockUniversalStore,
        });

        const store = getTestProviderStoreById('provider-1');
        const listener = vi.fn();

        // Act - register listener and trigger clearAll
        const unsubscribe = store.onClearAll(listener);
        fullTestProviderStore.clearAll();

        // Assert - verify listener was called
        await vi.waitFor(() => {
          expect(listener).toHaveBeenCalledTimes(1);
        });

        // Act - unsubscribe and trigger again
        unsubscribe();
        fullTestProviderStore.clearAll();

        // Assert - verify listener was not called after unsubscribe
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    describe('settingsChanged', () => {
      it('should register and call listener when settingsChanged is triggered', async () => {
        // Arrange - create store and setup listener
        const mockUniversalStore = new MockUniversalStore<
          TestProviderStateByProviderId,
          TestProviderStoreEvent
        >({
          ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
          initialState,
        });

        const { getTestProviderStoreById, fullTestProviderStore } = createTestProviderStore({
          universalTestProviderStore: mockUniversalStore,
        });

        const store = getTestProviderStoreById('provider-1');
        const listener = vi.fn();

        // Act - register listener and trigger settings change
        const unsubscribe = fullTestProviderStore.onSettingsChanged(listener);
        store.settingsChanged();

        // Assert - verify listener was called
        await vi.waitFor(() => {
          expect(listener).toHaveBeenCalledTimes(1);
        });

        // Act - unsubscribe and trigger again
        unsubscribe();
        store.settingsChanged();

        // Assert - verify listener was not called after unsubscribe
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('useTestProviderStore', () => {
    it('should return all states when no selector is provided', () => {
      // Arrange - create store with initial state
      const mockUniversalStore = new MockUniversalStore<
        TestProviderStateByProviderId,
        TestProviderStoreEvent
      >({
        ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
        initialState,
      });

      const testProviderStore = createTestProviderStore({
        universalTestProviderStore: mockUniversalStore,
        useUniversalStore,
      });

      // Act - render hook without selector
      const { result } = renderHook(() => testProviderStore.useTestProviderStore());

      // Assert - verify all states are returned
      expect(result.current).toEqual(initialState);
    });

    it('should return selected states when selector is provided', () => {
      // Arrange - create store with initial state
      const mockUniversalStore = new MockUniversalStore<
        TestProviderStateByProviderId,
        TestProviderStoreEvent
      >({
        ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
        initialState,
      });

      const testProviderStore = createTestProviderStore({
        universalTestProviderStore: mockUniversalStore,
        useUniversalStore,
      });

      // Act - render hook with selector
      const { result } = renderHook(() =>
        testProviderStore.useTestProviderStore((state) => state['provider-1'])
      );

      // Assert - verify selected state is returned
      expect(result.current).toEqual('test-provider-state:running');
    });

    it('should re-render when test provider state matching the selector change', async () => {
      // Arrange - create store and setup render counter
      const { useTestProviderStore, fullTestProviderStore } = createTestProviderStore({
        universalTestProviderStore: new MockUniversalStore({
          ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
          initialState,
        }),
        useUniversalStore,
      });
      const renderCounter = vi.fn();

      // Create a selector that only returns provider-1 state
      const provider1Selector = (state: TestProviderStateByProviderId) => state['provider-1'];

      // Act - render hook with selector
      const { result } = renderHook(() => {
        renderCounter();
        return useTestProviderStore(provider1Selector);
      });

      // Assert - verify initial render
      expect(renderCounter).toHaveBeenCalledTimes(1);
      expect(result.current).toEqual('test-provider-state:running');

      // Act - update provider-1 state
      act(() => {
        fullTestProviderStore.setFullState((currentState) => ({
          ...currentState,
          'provider-1': 'test-provider-state:succeeded',
        }));
      });

      // Assert - verify re-render with new state
      expect(renderCounter).toHaveBeenCalledTimes(2);
      expect(result.current).toEqual('test-provider-state:succeeded');
    });

    it('should not re-render when test provider state not matching the selector change', async () => {
      // Arrange - create store and setup render counter
      const { useTestProviderStore, fullTestProviderStore } = createTestProviderStore({
        universalTestProviderStore: new MockUniversalStore({
          ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
          initialState,
        }),
        useUniversalStore,
      });
      const renderCounter = vi.fn();

      // Create a selector that only returns provider-1 state
      const provider1Selector = (state: TestProviderStateByProviderId) => state['provider-1'];

      // Act - render hook with selector
      const { result } = renderHook(() => {
        renderCounter();
        return useTestProviderStore(provider1Selector);
      });

      // Assert - verify initial render
      expect(renderCounter).toHaveBeenCalledTimes(1);
      expect(result.current).toEqual('test-provider-state:running');

      // Act - update provider-2 state
      act(() => {
        fullTestProviderStore.setFullState((currentState) => ({
          ...currentState,
          'provider-2': 'test-provider-state:succeeded',
        }));
      });

      // Assert - verify no re-render occurred
      expect(renderCounter).toHaveBeenCalledTimes(1);
      expect(result.current).toEqual('test-provider-state:running');
    });
  });
});
