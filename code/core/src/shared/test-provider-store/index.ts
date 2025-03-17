import type { UniversalStore } from '../universal-store';
import type { BaseEvent, StoreOptions } from '../universal-store/types';
import type { useUniversalStore as managerUseUniversalStore } from '../universal-store/use-universal-store-manager';

export const UNIVERSAL_TEST_PROVIDER_STORE_OPTIONS: StoreOptions<TestProviderStateByProviderId> = {
  id: 'storybook/test-provider',
  leader: true,
  initialState: {},
};

export type TestProviderState =
  | 'test-provider-state:pending'
  | 'test-provider-state:running'
  | 'test-provider-state:succeeded'
  | 'test-provider-state:crashed';
export type TestProviderId = string;
export type TestProviderStateByProviderId = Record<TestProviderId, TestProviderState>;

type TestProviderStoreEventType = 'run-all' | 'clear-all' | 'settings-changed';

export interface TestProviderStoreEvent extends BaseEvent {
  type: TestProviderStoreEventType;
}

type BaseTestProviderStore = {
  settingsChanged: () => void;
  onRunAll: (listener: () => void) => () => void;
  onClearAll: (listener: () => void) => () => void;
};

type FullTestProviderStore = BaseTestProviderStore & {
  getFullState: UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>['getState'];
  setFullState: UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>['setState'];
  onSettingsChanged: (listener: (testProviderId: TestProviderId) => void) => () => void;
  runAll: () => void;
  clearAll: () => void;
};

export type TestProviderStoreById = BaseTestProviderStore & {
  getState: () => TestProviderState;
  setState: (state: TestProviderState) => void;
  runWithState: (callback: () => void) => void;
  testProviderId: TestProviderId;
};

export type UseTestProviderStore = <T = TestProviderStateByProviderId>(
  selector?: (state: TestProviderStateByProviderId) => T
) => T;

export function createTestProviderStore(params: {
  universalTestProviderStore: UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>;
  useUniversalStore?: never;
}): {
  getTestProviderStore: (testProviderId: TestProviderId) => TestProviderStoreById;
  fullTestProviderStore: FullTestProviderStore;
};
export function createTestProviderStore(params: {
  universalTestProviderStore: UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>;
  useUniversalStore: typeof managerUseUniversalStore;
}): {
  getTestProviderStore: (testProviderId: TestProviderId) => TestProviderStoreById;
  fullTestProviderStore: FullTestProviderStore;
  useTestProviderStore: UseTestProviderStore;
};
export function createTestProviderStore({
  universalTestProviderStore,
  useUniversalStore,
}: {
  universalTestProviderStore: UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>;
  useUniversalStore?: typeof managerUseUniversalStore;
}) {
  const baseStore: BaseTestProviderStore = {
    settingsChanged: () => {
      universalTestProviderStore.send({ type: 'settings-changed' });
    },
    onRunAll: (listener) => universalTestProviderStore.subscribe('run-all', listener),
    onClearAll: (listener) => universalTestProviderStore.subscribe('clear-all', listener),
  };

  const fullTestProviderStore: FullTestProviderStore = {
    ...baseStore,
    getFullState: universalTestProviderStore.getState,
    setFullState: universalTestProviderStore.setState,
    onSettingsChanged: (listener) =>
      universalTestProviderStore.subscribe('settings-changed', listener),
    runAll: () => universalTestProviderStore.send({ type: 'run-all' }),
    clearAll: () => universalTestProviderStore.send({ type: 'clear-all' }),
  };

  const getTestProviderStore = (testProviderId: string): TestProviderStoreById => {
    const getStateForTestProvider = () => universalTestProviderStore.getState()[testProviderId];
    const setStateForTestProvider = (state: TestProviderState) => {
      universalTestProviderStore.setState((currentState) => ({
        ...currentState,
        [testProviderId]: state,
      }));
    };
    // Initialize the state to 'pending' if it doesn't exist yet
    if (!getStateForTestProvider()) {
      setStateForTestProvider('test-provider-state:pending');
    }
    return {
      ...baseStore,
      testProviderId,
      getState: getStateForTestProvider,
      setState: setStateForTestProvider,
      runWithState: async (callback) => {
        setStateForTestProvider('test-provider-state:running');
        try {
          await callback();
          setStateForTestProvider('test-provider-state:succeeded');
        } catch (error) {
          setStateForTestProvider('test-provider-state:crashed');
        }
      },
    };
  };

  if (useUniversalStore) {
    return {
      getTestProviderStore,
      fullTestProviderStore,
      useTestProviderStore: <T = TestProviderStateByProviderId>(
        selector?: (testProviders: TestProviderStateByProviderId) => T
      ) => useUniversalStore(universalTestProviderStore, selector as any)[0] as T,
    };
  }

  return {
    getTestProviderStore,
    fullTestProviderStore,
  };
}
