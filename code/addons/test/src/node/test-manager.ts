import type { TestResult, TestState } from 'vitest/dist/node.js';

import type { experimental_UniversalStore } from 'storybook/internal/core-server';
import type {
  StatusStoreByTypeId,
  StatusValue,
  TestProviderStoreById,
} from 'storybook/internal/types';

import { isEqual, throttle } from 'es-toolkit';
import type { Report } from 'storybook/preview-api';

import { STATUS_TYPE_ID_A11Y, STATUS_TYPE_ID_COMPONENT_TEST, storeOptions } from '../constants';
import type {
  StoreEvent,
  StoreState,
  ToggleWatchingEvent,
  TriggerRunEvent,
  VitestError,
} from '../types';
import { errorToErrorLike } from '../utils';
import { VitestManager } from './vitest-manager';

type TestManagerOptions = {
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

    this.vitestManager = new VitestManager(this);

    this.store.subscribe('TRIGGER_RUN', this.handleTriggerRunEvent.bind(this));
    this.store.subscribe('CANCEL_RUN', this.handleCancelEvent.bind(this));
    this.store.onStateChange(this.handleConfigChange.bind(this));

    this.store
      .untilReady()
      .then(() =>
        this.vitestManager.startVitest({ coverage: this.store.getState().config.coverage })
      )
      .then(() => this.onReady?.())
      .catch((e) => {
        this.reportFatalError('Failed to start Vitest', e);
      });
  }

  async handleConfigChange(state: StoreState) {
    process.env.VITEST_STORYBOOK_CONFIG = JSON.stringify(state.config);
  }

  async handleTriggerRunEvent(event: TriggerRunEvent) {
    return this.runTestsWithState({
      storyIds: event.payload?.storyIds,
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
    callback,
  }: {
    storyIds?: string[];
    callback: () => Promise<void>;
  }) {
    this.componentTestStatusStore.unset(storyIds);
    this.a11yStatusStore.unset(storyIds);

    this.store.setState((s) => ({
      ...s,
      currentRun: {
        ...storeOptions.initialState.currentRun,
        startedAt: Date.now(),
        storyIds: storyIds,
        coverage: s.config.coverage,
        a11y: s.config.a11y,
      },
    }));
    return this.testProviderStore.runWithState(callback);
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

  throttledFlushTestCaseResults = throttle(() => {
    const testCaseResultsToFlush = this.batchedTestCaseResults;
    this.batchedTestCaseResults = [];

    this.store.setState((s) => {
      const finishedTestCount = s.currentRun.finishedTestCount + testCaseResultsToFlush.length;
      return {
        ...s,
        currentRun: {
          ...s.currentRun,
          finishedTestCount,
          // in some cases the finishedTestCount can exceed the anticipated totalTestCount
          // e.g. when testing more tests than the stories we know about upfront
          // in those cases, we set the totalTestCount to the finishedTestCount
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
