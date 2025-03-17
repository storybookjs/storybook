import { describe, expectTypeOf, it } from 'vitest';

import {
  type TestProviderState,
  type TestProviderStateByProviderId,
  UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS,
  createTestProviderStore,
} from '.';
import { MockUniversalStore } from '../universal-store/mock';
import { useUniversalStore } from '../universal-store/use-universal-store-manager';

const { fullTestProviderStore, getTestProviderStoreById, useTestProviderStore } =
  createTestProviderStore({
    universalTestProviderStore: MockUniversalStore.create(UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS),
    useUniversalStore,
  });

const typedTestProviderStore = getTestProviderStoreById('test-provider-1');

describe('Test Provider Store', () => {
  it('getFullState should return typed provider states', () => {
    const states = fullTestProviderStore.getFullState();
    expectTypeOf(states).toEqualTypeOf<TestProviderStateByProviderId>();

    const typedState = typedTestProviderStore.getState();
    expectTypeOf(typedState).toEqualTypeOf<TestProviderState>();
  });

  it('setFullState should accept typed provider states', () => {
    expectTypeOf(fullTestProviderStore.setFullState)
      .parameter(0)
      .toMatchTypeOf<
        | TestProviderStateByProviderId
        | ((state: TestProviderStateByProviderId) => TestProviderStateByProviderId)
      >();
    expectTypeOf(typedTestProviderStore.setState).parameter(0).toEqualTypeOf<TestProviderState>();
  });

  it('runWithState should accept a callback', () => {
    expectTypeOf(typedTestProviderStore.runWithState)
      .parameter(0)
      .toEqualTypeOf<() => void | Promise<void>>();
  });

  it('onRunAll should accept a callback', () => {
    expectTypeOf(fullTestProviderStore.onRunAll).parameter(0).toEqualTypeOf<() => void>();
    expectTypeOf(typedTestProviderStore.onRunAll).parameter(0).toEqualTypeOf<() => void>();
  });

  it('onClearAll should accept a callback with no parameters', () => {
    expectTypeOf(fullTestProviderStore.onClearAll).parameter(0).toEqualTypeOf<() => void>();
    expectTypeOf(typedTestProviderStore.onClearAll).parameter(0).toEqualTypeOf<() => void>();
  });

  it('settingsChanged should be callable with no parameters', () => {
    expectTypeOf(fullTestProviderStore.settingsChanged).toBeFunction();
    expectTypeOf(fullTestProviderStore.settingsChanged).parameters.toEqualTypeOf<[]>();

    expectTypeOf(typedTestProviderStore.settingsChanged).toBeFunction();
    expectTypeOf(typedTestProviderStore.settingsChanged).parameters.toEqualTypeOf<[]>();
  });

  it('useTestProviderStore should return typed provider states', () => {
    // Without selector
    const allStates = useTestProviderStore();
    expectTypeOf(allStates).toEqualTypeOf<TestProviderStateByProviderId>();

    // With selector
    const selectedState = useTestProviderStore((states) => {
      expectTypeOf(states).toEqualTypeOf<TestProviderStateByProviderId>();
      return states['test-provider-1'];
    });
    expectTypeOf(selectedState).toEqualTypeOf<TestProviderState>();
  });
});
