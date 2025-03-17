// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fullStatusStore, useStatusStore } from '../../manager-api/stores/status';
import { MockUniversalStore } from '../universal-store/mock';
import { useUniversalStore } from '../universal-store/use-universal-store-manager';
import {
  type TestProviderState,
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
        const { fullTestProviderStore } = createTestProviderStore({
          universalTestProviderStore: new MockUniversalStore<
            TestProviderStateByProviderId,
            TestProviderStoreEvent
          >({
            ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
            initialState,
          }),
        });

        const result = fullTestProviderStore.getFullState();
        expect(result).toEqual(initialState);
      });
    });

    describe('setState', () => {
      it('should set state', () => {
        const { fullTestProviderStore } = createTestProviderStore({
          universalTestProviderStore: new MockUniversalStore<
            TestProviderStateByProviderId,
            TestProviderStoreEvent
          >({
            ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
            initialState,
          }),
        });

        fullTestProviderStore.setFullState((currentState) => ({
          ...currentState,
          'provider-3': 'test-provider-state:crashed',
        }));
        const result = fullTestProviderStore.getFullState();

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
      it('should set initial provider state to pending', () => {
        const { getTestProviderStoreById, fullTestProviderStore } = createTestProviderStore({
          universalTestProviderStore: new MockUniversalStore<
            TestProviderStateByProviderId,
            TestProviderStoreEvent
          >(UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS),
        });

        const store = getTestProviderStoreById('provider-1');
        expect(store.getState()).toBe('test-provider-state:pending');

        // Check that the provider was added to the full state
        const fullState = fullTestProviderStore.getFullState();
        expect(fullState).toEqual({
          'provider-1': 'test-provider-state:pending',
        });
      });

      it('should return current state for existing provider', () => {
        const { getTestProviderStoreById } = createTestProviderStore({
          universalTestProviderStore: new MockUniversalStore<
            TestProviderStateByProviderId,
            TestProviderStoreEvent
          >({
            ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
            initialState: { 'provider-1': 'test-provider-state:running' },
          }),
        });

        const store = getTestProviderStoreById('provider-1');
        expect(store.getState()).toBe('test-provider-state:running');
      });
    });

    describe('setState', () => {
      it('should set state for the provider', async () => {
        const { getTestProviderStoreById, fullTestProviderStore } = createTestProviderStore({
          universalTestProviderStore: new MockUniversalStore<
            TestProviderStateByProviderId,
            TestProviderStoreEvent
          >({
            ...UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
            initialState,
          }),
        });

        const store = getTestProviderStoreById('provider-1');
        store.setState('test-provider-state:crashed');

        // Wait for the specific provider state to be updated
        await vi.waitFor(() => {
          expect(store.getState()).toBe('test-provider-state:crashed');
        });

        // Verify that only this provider's state was changed in the full state
        const fullState = fullTestProviderStore.getFullState();
        expect(fullState).toEqual({
          'provider-1': 'test-provider-state:crashed',
          'provider-2': 'test-provider-state:succeeded',
        });
      });
    });

    describe('runWithState', () => {
      it('should update state during execution flow', async () => {
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

        store.runWithState(gatedSuccessCallback);

        expect(store.getState()).toBe('test-provider-state:running');

        runningGate!();

        await vi.waitFor(() => {
          expect(store.getState()).toBe('test-provider-state:succeeded');
        });
      });

      it('should handle errors and update state to crashed', async () => {
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

        store.runWithState(gatedErrorCallback);

        expect(store.getState()).toBe('test-provider-state:running');

        runningGate!();

        await vi.waitFor(() => {
          expect(store.getState()).toBe('test-provider-state:crashed');
        });
      });
    });

    describe('onRunAll', () => {
      it('should register and call listener when runAll is triggered', () => {
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

        const unsubscribe = store.onRunAll(listener);

        fullTestProviderStore.runAll();
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        fullTestProviderStore.runAll();
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    describe('onClearAll', () => {
      it('should register and call listener when clearAll is triggered', () => {
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

        const unsubscribe = store.onClearAll(listener);

        fullTestProviderStore.clearAll();
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        fullTestProviderStore.clearAll();
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    describe('settingsChanged', () => {
      it('should register and call listener when settingsChanged is triggered', () => {
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

        const unsubscribe = fullTestProviderStore.onSettingsChanged(listener);

        store.settingsChanged();
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        store.settingsChanged();
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('useTestProviderStore', () => {
    it('should return all states when no selector is provided', () => {
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

      const { result } = renderHook(() => testProviderStore.useTestProviderStore());
      expect(result.current).toEqual(initialState);
    });

    it('should return selected states when selector is provided', () => {
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

      const { result } = renderHook(() =>
        testProviderStore.useTestProviderStore((state) => state['provider-1'])
      );
      expect(result.current).toEqual('test-provider-state:running');
    });

    it('should re-render when test provider state matching the selector change', async () => {
      // Arrange - create a test provider store
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

      // Act - render the hook with the selector
      const { result } = renderHook(() => {
        renderCounter();
        return useTestProviderStore(provider1Selector);
      });

      // Assert - initial render
      expect(renderCounter).toHaveBeenCalledTimes(1);
      expect(result.current).toEqual('test-provider-state:running');

      // Act - update a state for provider-1
      act(() => {
        fullTestProviderStore.setFullState((currentState) => ({
          ...currentState,
          'provider-1': 'test-provider-state:succeeded',
        }));
      });

      // Assert - the hook should re-render with the updated status
      expect(renderCounter).toHaveBeenCalledTimes(2);
      expect(result.current).toEqual('test-provider-state:succeeded');
    });

    it('should not re-render when test provider state not matching the selector change', async () => {
      // Arrange - create a test provider store
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

      // Act - render the hook with the selector
      const { result } = renderHook(() => {
        renderCounter();
        return useTestProviderStore(provider1Selector);
      });

      // Assert - initial render
      expect(renderCounter).toHaveBeenCalledTimes(1);
      expect(result.current).toEqual('test-provider-state:running');

      // Act - update a state for provider-2
      act(() => {
        fullTestProviderStore.setFullState((currentState) => ({
          ...currentState,
          'provider-2': 'test-provider-state:succeeded',
        }));
      });

      // Assert - the hook should not re-render since the change doesn't affect the selected data
      expect(renderCounter).toHaveBeenCalledTimes(1);
      expect(result.current).toEqual('test-provider-state:running');
    });
  });
});
