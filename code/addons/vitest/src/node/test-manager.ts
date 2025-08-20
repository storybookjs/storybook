import type { TestResult, TestState } from 'vitest/dist/node.js';

import type { experimental_UniversalStore } from 'storybook/internal/core-server';
import type {
  Options,
  StatusStoreByTypeId,
  StatusValue,
  TestProviderStoreById,
} from 'storybook/internal/types';

import { throttle } from 'es-toolkit/function';
import type { Report } from 'storybook/preview-api';

import { STATUS_TYPE_ID_A11Y, STATUS_TYPE_ID_COMPONENT_TEST, storeOptions } from '../constants';
import type { RunTrigger, StoreEvent, StoreState, TriggerRunEvent, VitestError } from '../types';
import { errorToErrorLike } from '../utils';
import { VitestManager } from './vitest-manager';

export type TestManagerOptions = {
  storybookOptions: Options;
  store: experimental_UniversalStore<StoreState, StoreEvent>;
  componentTestStatusStore: StatusStoreByTypeId;
  a11yStatusStore: StatusStoreByTypeId;
  testProviderStore: TestProviderStoreById;
  onError?: (message: string, error: Error) => void;
  onReady?: () => void;
};

const testStateToStatusValueMap: Record<TestState | 'warning', StatusValue> = {
  pending: 'status-value:pending',
  passed: 'status-value:success',
  warning: 'status-value:warning',
  failed: 'status-value:error',
  skipped: 'status-value:unknown',
};

export class TestManager {
  public store: TestManagerOptions['store'];

  public vitestManager: VitestManager;

  private componentTestStatusStore: TestManagerOptions['componentTestStatusStore'];

  private a11yStatusStore: TestManagerOptions['a11yStatusStore'];

  private testProviderStore: TestManagerOptions['testProviderStore'];

  private onReady?: TestManagerOptions['onReady'];

  public storybookOptions: Options;

  private batchedTestCaseResults: {
    storyId: string;
    testResult: TestResult;
    reports?: Report[];
  }[] = [];

  constructor(options: TestManagerOptions) {
    this.store = options.store;
    this.componentTestStatusStore = options.componentTestStatusStore;
    this.a11yStatusStore = options.a11yStatusStore;
    this.testProviderStore = options.testProviderStore;
    this.onReady = options.onReady;
    this.storybookOptions = options.storybookOptions;

    this.vitestManager = new VitestManager(this);

    this.store.subscribe('TRIGGER_RUN', this.handleTriggerRunEvent.bind(this));
    this.store.subscribe('CANCEL_RUN', this.handleCancelEvent.bind(this));
    this.store
      .untilReady()
      .then(() => {
        return this.vitestManager.startVitest({ coverage: this.store.getState().config.coverage });
      })
      .then(() => this.onReady?.())
      .catch((e) => {
        this.reportFatalError('Failed to start Vitest', e);
      });
  }

  async handleTriggerRunEvent(event: TriggerRunEvent) {
    await this.runTestsWithState({
      storyIds: event.payload.storyIds,
      triggeredBy: event.payload.triggeredBy,
      callback: async () => {
        try {
          await this.vitestManager.vitestRestartPromise;
          await this.vitestManager.runTests(event.payload);
        } catch (err) {
          this.reportFatalError('Failed to run tests', err);
          throw err;
        }
      },
    });
  }

  async handleCancelEvent() {
    try {
      this.store.setState((s) => ({
        ...s,
        cancelling: true,
      }));
      await this.vitestManager.cancelCurrentRun();
    } catch (err) {
      this.reportFatalError('Failed to cancel tests', err);
    } finally {
      this.store.setState((s) => ({
        ...s,
        cancelling: false,
      }));
    }
  }

  async runTestsWithState({
    storyIds,
    triggeredBy,
    callback,
  }: {
    storyIds?: string[];
    triggeredBy: RunTrigger;
    callback: () => Promise<void>;
  }) {
    this.componentTestStatusStore.unset(storyIds);
    this.a11yStatusStore.unset(storyIds);

    this.store.setState((s) => ({
      ...s,
      currentRun: {
        ...storeOptions.initialState.currentRun,
        triggeredBy,
        startedAt: Date.now(),
        storyIds: storyIds,
        config: s.config,
      },
    }));
    // set the config at the start of a test run,
    // so that changing the config during the test run does not affect the currently running test run
    process.env.VITEST_STORYBOOK_CONFIG = JSON.stringify(this.store.getState().config);

    await this.testProviderStore.runWithState(async () => {
      await callback();
      this.store.send({
        type: 'TEST_RUN_COMPLETED',
        payload: this.store.getState().currentRun,
      });
      if (this.store.getState().currentRun.unhandledErrors.length > 0) {
        throw new Error('Tests completed but there are unhandled errors');
      }
    });
  }

  onTestModuleCollected(collectedTestCount: number) {
    this.store.setState((s) => ({
      ...s,
      currentRun: {
        ...s.currentRun,
        totalTestCount: (s.currentRun.totalTestCount ?? 0) + collectedTestCount,
      },
    }));
  }

  onTestCaseResult(result: { storyId?: string; testResult: TestResult; reports?: Report[] }) {
    const { storyId, testResult, reports } = result;
    if (!storyId) {
      return;
    }

    this.batchedTestCaseResults.push({ storyId, testResult, reports });
    this.throttledFlushTestCaseResults();
  }

  /**
   * Throttled function to process batched test case results.
   *
   * This function:
   *
   * 1. Takes all batched test case results and clears the batch
   * 2. Updates the store state with new test counts (component tests and a11y tests)
   * 3. Adjusts the totalTestCount if more tests were run than initially anticipated
   * 4. Creates status objects for component tests and updates the component test status store
   * 5. Creates status objects for a11y tests (if any) and updates the a11y status store
   *
   * The throttling (500ms) is necessary as the channel would otherwise get overwhelmed with events,
   * eventually causing the manager and dev server to lose connection.
   */
  throttledFlushTestCaseResults = throttle(() => {
    const testCaseResultsToFlush = this.batchedTestCaseResults;
    this.batchedTestCaseResults = [];

    this.store.setState((s) => {
      let { success: ctSuccess, error: ctError } = s.currentRun.componentTestCount;
      let { success: a11ySuccess, warning: a11yWarning, error: a11yError } = s.currentRun.a11yCount;
      testCaseResultsToFlush.forEach(({ testResult, reports }) => {
        if (testResult.state === 'passed') {
          ctSuccess++;
        } else if (testResult.state === 'failed') {
          ctError++;
        }
        reports
          ?.filter((r) => r.type === 'a11y')
          .forEach((report) => {
            if (report.status === 'passed') {
              a11ySuccess++;
            } else if (report.status === 'warning') {
              a11yWarning++;
            } else if (report.status === 'failed') {
              a11yError++;
            }
          });
      });
      const finishedTestCount = ctSuccess + ctError;

      return {
        ...s,
        currentRun: {
          ...s.currentRun,
          componentTestCount: { success: ctSuccess, error: ctError },
          a11yCount: { success: a11ySuccess, warning: a11yWarning, error: a11yError },
          // in some cases successes and errors can exceed the anticipated totalTestCount
          // e.g. when testing more tests than the stories we know about upfront
          // in those cases, we set the totalTestCount to the sum of successes and errors
          totalTestCount:
            finishedTestCount > (s.currentRun.totalTestCount ?? 0)
              ? finishedTestCount
              : s.currentRun.totalTestCount,
        },
      };
    });

    const componentTestStatuses = testCaseResultsToFlush.map(({ storyId, testResult }) => ({
      storyId,
      typeId: STATUS_TYPE_ID_COMPONENT_TEST,
      value: testStateToStatusValueMap[testResult.state],
      title: 'Component tests',
      description: testResult.errors?.map((error) => error.stack || error.message).join('\n') ?? '',
      sidebarContextMenu: false,
    }));

    this.componentTestStatusStore.set(componentTestStatuses);

    const a11yStatuses = testCaseResultsToFlush
      .flatMap(({ storyId, reports }) =>
        reports
          ?.filter((r) => r.type === 'a11y')
          .map((a11yReport) => ({
            storyId,
            typeId: STATUS_TYPE_ID_A11Y,
            value: testStateToStatusValueMap[a11yReport.status],
            title: 'Accessibility tests',
            description: '',
            sidebarContextMenu: false,
          }))
      )
      .filter((a11yStatus) => a11yStatus !== undefined);

    if (a11yStatuses.length > 0) {
      this.a11yStatusStore.set(a11yStatuses);
    }
  }, 500);

  onTestRunEnd(endResult: { totalTestCount: number; unhandledErrors: VitestError[] }) {
    this.throttledFlushTestCaseResults.flush();
    this.store.setState((s) => ({
      ...s,
      currentRun: {
        ...s.currentRun,
        // when the test run is finished, we can set the totalTestCount to the actual number of tests run
        // this number can be lower than the total number of tests we anticipated upfront
        // e.g. when some tests where skipped without us knowing about it upfront
        totalTestCount: endResult.totalTestCount,
        unhandledErrors: endResult.unhandledErrors,
        finishedAt: Date.now(),
      },
    }));
  }

  onCoverageCollected(coverageSummary: StoreState['currentRun']['coverageSummary']) {
    this.store.setState((s) => ({
      ...s,
      currentRun: { ...s.currentRun, coverageSummary },
    }));
  }

  async reportFatalError(message: string, error: Error | any) {
    await this.store.untilReady();
    this.store.send({
      type: 'FATAL_ERROR',
      payload: {
        message,
        error: errorToErrorLike(error),
      },
    });
  }

  static async start(options: TestManagerOptions) {
    return new Promise<TestManager>((resolve) => {
      const testManager = new TestManager({
        ...options,
        onReady: () => {
          resolve(testManager);
          options.onReady?.();
        },
      });
    });
  }
}
