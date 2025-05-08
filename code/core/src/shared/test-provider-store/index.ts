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

export type TestProviderStoreEvent = BaseEvent & {
  type: TestProviderStoreEventType;
};

type BaseTestProviderStore = {
  /**
   * Notifies all listeners that settings have changed for test providers. The Storybook UI will
   * highlight the test providers to tell the user that settings has changed.
   */
  settingsChanged: () => void;

  /**
   * Subscribe to clicks on the "Run All" button, that is supposed to trigger all test providers to
   * run. Your test provider should do the "main thing" when this happens, similar to when the user
   * triggers your test provider specifically.
   *
   * @example
   *
   * ```typescript
   * // Subscribe to run-all events
   * const unsubscribe = myTestProviderStore.onRunAll(() => {
   *   await runAllMyTests();
   * });
   * ```
   */
  onRunAll: (listener: () => void) => () => void;

  /**
   * Subscribe to clicks on the "Clear All" button, that is supposed to clear all state from test
   * providers. Storybook already clears all statuses, but if your test provider has more
   * non-status-based state, you can use this to clear that here.
   *
   * @remarks
   * The purpose of this is _not_ to clear your test provider's settings, only the test results.
   * @example
   *
   * ```typescript
   * // Subscribe to clear-all events
   * const unsubscribe = myTestProviderStore.onClearAll(() => {
   *   clearMyTestResults();
   * });
   *
   * // Later, when no longer needed
   * unsubscribe();
   * ```
   */
  onClearAll: (listener: () => void) => () => void;
};

/**
 * Test provider store that holds _all_ test provider's states.
 *
 * This is an internal store only meant to be used by Storybook UI itself. The API can change at any
 * time. Addons and test providers should use the `getTestProvider` function instead.
 */
type FullTestProviderStore = BaseTestProviderStore & {
  /**
   * Gets the full state of all test providers as a record of provider IDs to their states
   *
   * @example
   *
   * ```typescript
   * // Get the current state of all test providers
   * const allProviderStates = fullTestProviderStore.getFullState();
   * console.log(allProviderStates);
   * // Example output: { 'provider-1': 'test-provider-state:running', 'provider-2': 'test-provider-state:succeeded' }
   *
   * // Check if any providers are in a specific state
   * const hasRunningTests = Object.values(allProviderStates).some(
   *   (state) => state === 'test-provider-state:running'
   * );
   * ```
   */
  getFullState: UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>['getState'];

  /**
   * Sets the full state of all test providers, replacing the current state completely
   *
   * @example
   *
   * ```typescript
   * // Set all providers to a specific state
   * fullTestProviderStore.setFullState({
   *   'provider-1': 'test-provider-state:pending',
   *   'provider-2': 'test-provider-state:pending',
   * });
   *
   * // Update state using a function that receives the current state
   * fullTestProviderStore.setFullState((currentState) => ({
   *   ...currentState,
   *   'provider-1': 'test-provider-state:running',
   * }));
   * ```
   */
  setFullState: UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>['setState'];

  /**
   * Subscribe to settingsChanged calls by test providers.
   *
   * @example
   *
   * ```typescript
   * // Subscribe to settings changes for any test provider
   * const unsubscribe = fullTestProviderStore.onSettingsChanged((providerId) => {
   *   console.log(`Settings changed for provider: ${providerId}`);
   *   // Update UI or reload configuration for the specific provider
   * });
   *
   * // Later, when no longer needed
   * unsubscribe();
   * ```
   */
  onSettingsChanged: (listener: (testProviderId: TestProviderId) => void) => () => void;

  /**
   * Triggers all test providers to start running their tests
   *
   * @example
   *
   * ```typescript
   * // Add a button to run all tests
   * const RunAllButton = () => (
   *   <button
   *     onClick={() => fullTestProviderStore.runAll()}
   *     disabled={isRunning}
   *   >
   *     Run All Tests
   *   </button>
   * );
   * ```
   */
  runAll: () => void;

  /**
   * Clears the state of all test providers, resetting them to their initial state
   *
   * @example
   *
   * ```typescript
   * // Add a button to clear all test results
   * const ClearAllButton = () => (
   *   <button onClick={() => fullTestProviderStore.clearAll()}>
   *     Clear All Test Results
   *   </button>
   * );
   * ```
   */
  clearAll: () => void;
};

/**
 * Represents a store for a specific test provider, identified by its unique ID. This store provides
 * methods to manage the state of an individual test provider, including getting and setting its
 * state, running operations with automatic state management, and accessing its unique identifier.
 *
 * Each test provider has its own instance of this store, allowing for independent state management
 * across different test providers in the application.
 *
 * @example
 *
 * ```typescript
 * // Get a store for a specific test provider
 * const grammarStore = getTestProviderStoreById('addon-grammar');
 *
 * // Check the current state
 * if (grammarStore.getState() === 'test-provider-state:pending') {
 *   console.log('Grammar tests are ready to run');
 * }
 *
 * // Run tests with automatic state management
 * grammarStore.runWithState(async () => {
 *   await runGrammarTests();
 * });
 * ```
 *
 * @see {@link TestProviderState} for possible state values
 * @see {@link BaseTestProviderStore} for methods inherited from the base store
 */
export type TestProviderStoreById = BaseTestProviderStore & {
  /**
   * Gets the current state of this specific test provider
   *
   * The state represents the current execution status of the test provider, which can be one of the
   * following:
   *
   * - 'test-provider-state:pending': Tests have not been run yet
   * - 'test-provider-state:running': Tests are currently running
   * - 'test-provider-state:succeeded': Tests completed successfully
   * - 'test-provider-state:crashed': Running tests failed or encountered an error
   *
   * Storybook UI will use this state to determine what to show in the UI.
   *
   * @remarks
   * The 'test-provider-state:crashed' is meant to signify that the test run as a whole failed to
   * execute for some reason. It should _not_ be set just because a number of tests failed, use
   * statuses and the status store for that. See {@link TestStatusStore} for managing individual test
   * statuses.
   * @example
   *
   * ```typescript
   * // Get the current state of a specific test provider
   * const state = testProviderStore.getState();
   *
   * // Conditionally render UI based on the state
   * const TestStatus = () => {
   *   const state = testProviderStore.getState();
   *
   *   if (state === 'test-provider-state:running') {
   *     return <Spinner />;
   *   } else if (state === 'test-provider-state:succeeded') {
   *     return <SuccessIcon />;
   *   } else if (state === 'test-provider-state:crashed') {
   *     return <ErrorIcon />;
   *   }
   *
   *   return <PendingIcon />;
   * };
   * ```
   */
  getState: () => TestProviderState;

  /**
   * Sets the state of this specific test provider
   *
   * This method allows you to manually update the execution state of the test provider. It's
   * typically used when you need to reflect the current status of test execution in the UI or when
   * you want to programmatically control the test provider's state.
   *
   * Common use cases include:
   *
   * - Setting to 'running' when tests start
   * - Setting to 'succeeded' when tests complete successfully
   * - Setting to 'crashed' when tests fail or encounter errors
   * - Setting to 'pending' to reset the state
   *
   * The state represents the current execution status of the test provider, which can be one of the
   * following:
   *
   * - 'test-provider-state:pending': Tests have not been run yet
   * - 'test-provider-state:running': Tests are currently running
   * - 'test-provider-state:succeeded': Tests completed successfully
   * - 'test-provider-state:crashed': Running tests failed or encountered an error
   *
   * Storybook UI will use this state to determine what to show in the UI.
   *
   * @remarks
   * The 'test-provider-state:crashed' is meant to signify that the test run as a whole failed to
   * execute for some reason. It should _not_ be set just because a number of tests failed, use
   * statuses and the status store for that. See {@link TestStatusStore} for managing individual test
   * statuses.
   *
   * For most use cases, consider using {@link runWithState} instead, which provides automatic state
   * management and error handling during test execution.
   * @example
   *
   * ```typescript
   * // Update the state when tests start running
   * const startTests = async () => {
   *   testProviderStore.setState('test-provider-state:running');
   *   ... run tests ...
   * };
   * ```
   */
  setState: (state: TestProviderState) => void;

  /**
   * Runs a callback and automatically updates the test provider's state with running, succeeded or
   * crashed, depending on the end result.
   *
   * - Immediately changes the state to 'running'
   * - If the callback returns/resolves, change the state to 'succeeded'.
   * - If the callback throws an error/rejects, change the state to 'crashed'.
   *
   * This approach helps prevent state inconsistencies that might occur if exceptions are thrown
   * during test execution.
   *
   * @example
   *
   * ```typescript
   * // Run tests with automatic state management
   * const runTests = () => {
   *   testProviderStore.runWithState(async () => {
   *     // The state is automatically set to 'running' before this callback
   *
   *     // Run tests here...
   *     const results = await executeTests();
   *   });
   * };
   * ```
   */
  runWithState: (callback: () => void | Promise<void>) => Promise<void>;

  /** The unique identifier for this test provider */
  testProviderId: TestProviderId;
};

/**
 * React OR preview hook for accessing the state of _all_ test providers. This hook will only
 * trigger a re-render when the state changes. It is recommended to pass the optional selector, to
 * get more fine-grained control of re-renders.
 *
 * @example
 *
 * ```typescript
 * const TestStatus = () => {
 *   const state = useTestProviderStore((state) => state['my-test-provider']);
 * };
 * ```
 */
export type UseTestProviderStore = <T = TestProviderStateByProviderId>(
  /**
   * Optional selector function to extract or transform specific parts of the state
   *
   * @example
   *
   * ```typescript
   * // Use the entire state
   * const allProviderStates = useTestProviderStore();
   *
   * // Get state for a specific provider
   * const myProviderState = useTestProviderStore((state) => state['my-test-provider']);
   *
   * // Get a count of providers in each state
   * const statusCounts = useTestProviderStore((state) => {
   *   const counts = {
   *     pending: 0,
   *     running: 0,
   *     succeeded: 0,
   *     crashed: 0,
   *   };
   *
   *   Object.values(state).forEach((status) => {
   *     if (status === 'test-provider-state:pending') counts.pending++;
   *     else if (status === 'test-provider-state:running') counts.running++;
   *     else if (status === 'test-provider-state:succeeded') counts.succeeded++;
   *     else if (status === 'test-provider-state:crashed') counts.crashed++;
   *   });
   *
   *   return counts;
   * });
   *
   * // Check if all tests have completed
   * const allTestsCompleted = useTestProviderStore((state) => {
   *   return Object.values(state).every(
   *     (status) =>
   *       status === 'test-provider-state:succeeded' ||
   *       status === 'test-provider-state:crashed'
   *   );
   * });
   * ```
   */
  selector?: (state: TestProviderStateByProviderId) => T
) => T;

export function createTestProviderStore(params: {
  universalTestProviderStore: UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>;
  useUniversalStore?: never;
}): {
  getTestProviderStoreById: (testProviderId: TestProviderId) => TestProviderStoreById;
  fullTestProviderStore: FullTestProviderStore;
  universalTestProviderStore: UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>;
};
export function createTestProviderStore(params: {
  universalTestProviderStore: UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>;
  useUniversalStore: typeof managerUseUniversalStore;
}): {
  getTestProviderStoreById: (testProviderId: TestProviderId) => TestProviderStoreById;
  fullTestProviderStore: FullTestProviderStore;
  universalTestProviderStore: UniversalStore<TestProviderStateByProviderId, TestProviderStoreEvent>;
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
      universalTestProviderStore.untilReady().then(() => {
        universalTestProviderStore.send({ type: 'settings-changed' });
      });
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
    runAll: async () => {
      await universalTestProviderStore.untilReady();
      universalTestProviderStore.send({ type: 'run-all' });
    },
    clearAll: async () => {
      await universalTestProviderStore.untilReady();
      universalTestProviderStore.send({ type: 'clear-all' });
    },
  };

  const getTestProviderStoreById = (testProviderId: string): TestProviderStoreById => {
    const getStateForTestProvider = () =>
      universalTestProviderStore.getState()[testProviderId] ?? 'test-provider-state:pending';
    const setStateForTestProvider = (state: TestProviderState) => {
      universalTestProviderStore.untilReady().then(() => {
        universalTestProviderStore.setState((currentState) => ({
          ...currentState,
          [testProviderId]: state,
        }));
      });
    };
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
      getTestProviderStoreById,
      fullTestProviderStore,
      universalTestProviderStore,
      useTestProviderStore: <T = TestProviderStateByProviderId>(
        selector?: (testProviders: TestProviderStateByProviderId) => T
      ) => useUniversalStore(universalTestProviderStore, selector as any)[0] as T,
    };
  }

  return {
    getTestProviderStoreById,
    fullTestProviderStore,
    universalTestProviderStore,
  };
}
