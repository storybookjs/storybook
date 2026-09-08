import type { TestError } from 'vitest';
import type { TestResult, TestState } from 'vitest/node';

import type { experimental_UniversalStore } from 'storybook/internal/core-server';
import type {
  Options,
  StatusStoreByTypeId,
  StatusValue,
  TestProviderStoreById,
} from 'storybook/internal/types';

import type { BuilderOptions } from '@storybook/builder-vite';

import { throttle } from 'es-toolkit/function';
import type { Report } from 'storybook/preview-api';

import { STATUS_TYPE_ID_A11Y, STATUS_TYPE_ID_COMPONENT_TEST, storeOptions } from '../constants.ts';
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
};

/** Matches the banner that vitest-plugin/setup-file.ts prepends to the message of failed stories. */
const DEBUG_BANNER_RE =
  /\n?(?:\x1B\[\d+m)?Click to debug the error directly in Storybook: [^\n]*\n+/g;

/**
 * `error.stack` holds the raw browser stack, pointing at the Vite URLs of Storybook's pre-bundled
 * internals. Vitest replaces it with `error.stacks`: source-mapped frames with Storybook's
 * instrumentation filtered out, matching what its own terminal output shows.
 */
function formatError(error: TestError): string {
  if (!error.stacks?.length) {
    return error.stack || error.message || '';
  }
  const message = (error.message ?? '').replace(DEBUG_BANNER_RE, '');
  const frames = error.stacks.map(
    ({ method, file, line, column }) =>
      `    at ${method || '<anonymous>'} (${file}:${line}:${column})`
  );
  return [message, ...frames].join('\n');
}

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

  private runComponentTestStatuses: CurrentRun['componentTestStatuses'] = [];

  private runA11yStatuses: CurrentRun['a11yStatuses'] = [];

  private runReports: CurrentRun['reports'] = {};

  private runA11yReports: CurrentRun['a11yReports'] = {};

  constructor(options: TestManagerOptions) {
    this.store = options.store;
    this.componentTestStatusStore = options.componentTestStatusStore;
    this.a11yStatusStore = options.a11yStatusStore;
    this.testProviderStore = options.testProviderStore;
    this.onReady = options.onReady;
    this.storybookOptions = options.storybookOptions;
    this.configLoader = options.configLoader;

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

    this.runComponentTestStatuses = [];
    this.runA11yStatuses = [];
    this.runReports = {};
    this.runA11yReports = {};

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
        payload: {
          ...this.store.getState().currentRun,
          componentTestStatuses: this.runComponentTestStatuses,
          a11yStatuses: this.runA11yStatuses,
          a11yReports: this.runA11yReports,
          reports: this.runReports,
        },
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
   * Throttled function to process batched test case results.
   *
   * This function:
   *
   * 1. Takes all batched test case results and clears the batch
   * 2. Updates the status stores with the just-processed batch
   * 3. Accumulates full-run statuses and reports locally so the per-flush store payload stays bounded
   * 4. Updates the synced store with counts only
   *
   * The throttling (500ms) still batches channel traffic. Full-run arrays stay off the synced store
   * until run end, so a late flush cannot re-serialize the whole run.
   */
  throttledFlushTestCaseResults = throttle(() => {
    const testCaseResultsToFlush = this.batchedTestCaseResults;
    this.batchedTestCaseResults = [];

    const componentTestStatuses = testCaseResultsToFlush.map(({ storyId, testResult }) => ({
      storyId,
      typeId: STATUS_TYPE_ID_COMPONENT_TEST,
      value: testStateToStatusValueMap[testResult.state],
      title: 'Component tests',
      description: testResult.errors?.map(formatError).join('\n') ?? '',
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

    if (componentTestStatuses.length > 0) {
      this.runComponentTestStatuses.push(...componentTestStatuses);
    }
    if (a11yStatuses.length > 0) {
      this.runA11yStatuses.push(...a11yStatuses);
    }
    Object.assign(this.runReports, reportsByStoryId);
    Object.assign(this.runA11yReports, a11yReportsByStoryId);

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
          totalTestCount:
            finishedTestCount > (s.currentRun.totalTestCount ?? 0)
              ? finishedTestCount
              : s.currentRun.totalTestCount,
        },
      };
    });
  }, 500);

  onTestRunEnd(endResult: { totalTestCount: number; unhandledErrors: VitestError[] }) {
    this.throttledFlushTestCaseResults.flush();
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
