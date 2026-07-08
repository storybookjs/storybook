import type { TestResult, TestState } from 'vitest/node';

import type { experimental_UniversalStore } from 'storybook/internal/core-server';
import type {
  Options,
  StatusStoreByTypeId,
  StatusValue,
  TestProviderStoreById,
} from 'storybook/internal/types';

import type { BuilderOptions } from '@storybook/builder-vite';

import { type ThrottledFunction, throttle } from 'es-toolkit/function';
import type { Report } from 'storybook/preview-api';

import {
  DEFAULT_MAX_TEST_CASE_RESULTS_PER_FLUSH,
  DEFAULT_TEST_STATUS_FLUSH_INTERVAL,
  STATUS_TYPE_ID_A11Y,
  STATUS_TYPE_ID_COMPONENT_TEST,
  storeOptions,
} from '../constants.ts';
import type {
  CurrentRun,
  RunConfig,
  RunTrigger,
  StoreEvent,
  StoreState,
  TriggerRunEvent,
  VitestError,
} from '../types.ts';
import { errorToErrorLike } from '../utils.ts';
import { VitestManager } from './vitest-manager.ts';

export type TestManagerOptions = {
  storybookOptions: Options;
  configLoader?: BuilderOptions['configLoader'];
  store: experimental_UniversalStore<StoreState, StoreEvent>;
  componentTestStatusStore: StatusStoreByTypeId;
  a11yStatusStore: StatusStoreByTypeId;
  testProviderStore: TestProviderStoreById;
  onError?: (message: string, error: Error) => void;
  onReady?: () => void;
  /**
   * How often (in ms) batched test-case results are flushed onto the channel during a run. Defaults
   * to {@link DEFAULT_TEST_STATUS_FLUSH_INTERVAL}. Larger values reduce WebSocket pressure on very
   * large storybooks at the cost of less frequent sidebar/status updates.
   */
  flushTestCaseResultsInterval?: number;
  /**
   * Maximum number of batched test-case results applied per flush. Defaults to
   * {@link DEFAULT_MAX_TEST_CASE_RESULTS_PER_FLUSH}, which is safe for any project size and isn't
   * meant to be tuned - this option exists so tests can shrink it to exercise chunking directly.
   */
  maxTestCaseResultsPerFlush?: number;
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

  public readonly configLoader?: TestManagerOptions['configLoader'];

  private batchedTestCaseResults: {
    storyId: string;
    testResult: TestResult;
    reports?: Report[];
  }[] = [];

  private maxTestCaseResultsPerFlush: number;

  constructor(options: TestManagerOptions) {
    this.store = options.store;
    this.componentTestStatusStore = options.componentTestStatusStore;
    this.a11yStatusStore = options.a11yStatusStore;
    this.testProviderStore = options.testProviderStore;
    this.onReady = options.onReady;
    this.storybookOptions = options.storybookOptions;
    this.configLoader = options.configLoader;
    this.maxTestCaseResultsPerFlush = Math.max(
      1,
      options.maxTestCaseResultsPerFlush ?? DEFAULT_MAX_TEST_CASE_RESULTS_PER_FLUSH
    );

    this.throttledFlushTestCaseResults = throttle(
      this.flushTestCaseResults,
      options.flushTestCaseResultsInterval ?? DEFAULT_TEST_STATUS_FLUSH_INTERVAL
    );

    this.vitestManager = new VitestManager(this);

    this.store.subscribe('TRIGGER_RUN', this.handleTriggerRunEvent.bind(this));
    this.store.subscribe('CANCEL_RUN', this.handleCancelEvent.bind(this));
    this.store
      .untilReady()
      .then(() => {
        return this.vitestManager.startVitest({
          coverage: this.store.getState().config.coverage,
        });
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
      configOverride: event.payload.configOverride,
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
    configOverride,
    callback,
  }: {
    storyIds?: string[];
    triggeredBy: RunTrigger;
    configOverride?: RunConfig;
    callback: () => Promise<void>;
  }) {
    this.componentTestStatusStore.unset(storyIds);
    this.a11yStatusStore.unset(storyIds);

    const runConfig = configOverride ?? this.store.getState().config;

    this.store.setState((s) => ({
      ...s,
      currentRun: {
        ...storeOptions.initialState.currentRun,
        triggeredBy,
        startedAt: Date.now(),
        storyIds: storyIds,
        config: runConfig,
      },
    }));
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

    const requestedStoryIds = this.store.getState().currentRun.storyIds;
    if (requestedStoryIds && !this.isRequestedStoryOrChild(storyId, requestedStoryIds)) {
      // In focused runs, Vitest name filtering can still pick up same-named tests in other files.
      // Drop those results here so status stores and run summaries only reflect requested stories.
      return;
    }

    this.batchedTestCaseResults.push({ storyId, testResult, reports });
    this.throttledFlushTestCaseResults();
  }

  private isRequestedStoryOrChild(storyId: string, requestedStoryIds: string[]) {
    if (requestedStoryIds.includes(storyId)) {
      return true;
    }

    const entry = this.store.getState().index.entries[storyId];
    return entry?.type === 'story' && !!entry.parent && requestedStoryIds.includes(entry.parent);
  }

  /**
   * Throttled wrapper around {@link flushTestCaseResults}, created in the constructor so the interval
   * can be configured.
   *
   * Throttling is necessary because each flush serializes status events onto the dev-server
   * WebSocket, and without it the channel gets overwhelmed with events. On large storybooks this
   * backlog can delay heartbeat processing in the manager and cause it to drop the connection with a
   * "Server timed out" error, so the interval is configurable via
   * {@link TestManagerOptions.flushTestCaseResultsInterval}.
   */
  public throttledFlushTestCaseResults: ThrottledFunction<() => void>;

  /**
   * Processes batched test case results.
   *
   * This function:
   *
   * 1. Takes up to {@link TestManagerOptions.maxTestCaseResultsPerFlush} batched test case results
   *    and removes them from the batch. Any remainder is drained via `setImmediate` rather than by
   *    re-arming the throttle: the throttle could synchronously re-enter this function when its
   *    interval has already elapsed, draining an unbounded number of chunks in one burst instead of
   *    yielding between them
   * 2. Updates the store state with new test counts (component tests and a11y tests)
   * 3. Adjusts the totalTestCount if more tests were run than initially anticipated
   * 4. Creates status objects for component tests and updates the component test status store
   * 5. Creates status objects for a11y tests (if any) and updates the a11y status store
   */
  private flushTestCaseResults = () => {
    const testCaseResultsToFlush = this.batchedTestCaseResults.splice(
      0,
      this.maxTestCaseResultsPerFlush
    );

    if (testCaseResultsToFlush.length === 0) {
      return;
    }

    const componentTestStatuses = testCaseResultsToFlush.map(({ storyId, testResult }) => ({
      storyId,
      typeId: STATUS_TYPE_ID_COMPONENT_TEST,
      value: testStateToStatusValueMap[testResult.state],
      title: 'Component tests',
      description: testResult.errors?.map((error) => error.stack || error.message).join('\n') ?? '',
      sidebarContextMenu: false,
    }));

    this.componentTestStatusStore.set(componentTestStatuses);

    const a11yReportsByStoryId: CurrentRun['a11yReports'] = {};
    const reportsByStoryId: CurrentRun['reports'] = {};
    const a11yStatuses: typeof componentTestStatuses = [];

    for (const { storyId, reports } of testCaseResultsToFlush) {
      if (reports?.length) {
        reportsByStoryId[storyId] = reports;
      }

      const storyA11yReports = reports?.filter((r) => r.type === 'a11y');
      if (!storyA11yReports?.length) {
        continue;
      }
      a11yReportsByStoryId[storyId] = storyA11yReports.map((report) => report.result);
      for (const a11yReport of storyA11yReports) {
        a11yStatuses.push({
          storyId,
          typeId: STATUS_TYPE_ID_A11Y,
          value: testStateToStatusValueMap[a11yReport.status],
          title: 'Accessibility tests',
          description: '',
          sidebarContextMenu: false,
        });
      }
    }

    if (a11yStatuses.length > 0) {
      this.a11yStatusStore.set(a11yStatuses);
    }

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
          a11yCount: {
            success: a11ySuccess,
            warning: a11yWarning,
            error: a11yError,
          },
          componentTestStatuses: s.currentRun.componentTestStatuses.concat(componentTestStatuses),
          a11yStatuses: s.currentRun.a11yStatuses.concat(a11yStatuses),
          /*
            TODO: a11yReports is just here for backwards compatibility with older versions of addon-mcp.
            They are also part of the more generic reports property, so we can remove this in a future major release when we can break compatibility.
          */
          a11yReports: {
            ...s.currentRun.a11yReports,
            ...a11yReportsByStoryId,
          },
          reports: {
            ...s.currentRun.reports,
            ...reportsByStoryId,
          },
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

    if (this.batchedTestCaseResults.length > 0) {
      setImmediate(this.flushTestCaseResults);
    }
  };

  async onTestRunEnd(endResult: { totalTestCount: number; unhandledErrors: VitestError[] }) {
    this.throttledFlushTestCaseResults.cancel();
    // Kick off (or continue) draining in the same bounded slices used during the run, then wait for
    // it to finish rather than flushing everything in one go - so a run that produces a lot of
    // results right before finishing can't turn the final flush into one oversized synchronous burst
    // either. flushTestCaseResults re-schedules itself via setImmediate while a backlog remains, so
    // this loop only needs to wait for that chain to catch up.
    this.flushTestCaseResults();
    while (this.batchedTestCaseResults.length > 0) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    this.store.setState((s) => {
      const focusedRunTotal =
        s.currentRun.componentTestCount.success + s.currentRun.componentTestCount.error;

      return {
        ...s,
        currentRun: {
          ...s.currentRun,
          // For focused runs, keep totals aligned with filtered case results.
          // For full runs, use Vitest's reported total.
          totalTestCount: s.currentRun.storyIds ? focusedRunTotal : endResult.totalTestCount,
          unhandledErrors: endResult.unhandledErrors,
          finishedAt: Date.now(),
        },
      };
    });
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
