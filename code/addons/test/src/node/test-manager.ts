import type { Channel } from 'storybook/internal/channels';
import {
  TESTING_MODULE_CANCEL_TEST_RUN_REQUEST,
  TESTING_MODULE_PROGRESS_REPORT,
  type TestingModuleCancelTestRunRequestPayload,
  type TestingModuleProgressReportPayload,
} from 'storybook/internal/core-events';
import type { experimental_UniversalStore } from 'storybook/internal/core-server';
import type { StatusStoreByTypeId, TestProviderStoreById } from 'storybook/internal/types';

import { isEqual } from 'es-toolkit';

import {
  type StoreEvent,
  type StoreState,
  TEST_PROVIDER_ID,
  type TriggerRunEvent,
} from '../constants';
import { VitestManager } from './vitest-manager';

type TestManagerOptions = {
  channel: Channel;
  store: experimental_UniversalStore<StoreState, StoreEvent>;
  componentTestStatusStore: StatusStoreByTypeId;
  a11yStatusStore: StatusStoreByTypeId;
  testProviderStore: TestProviderStoreById;
  onError?: (message: string, error: Error) => void;
  onReady?: () => void;
};

export class TestManager {
  private channel: TestManagerOptions['channel'];

  public store: TestManagerOptions['store'];

  private componentTestStatusStore: TestManagerOptions['componentTestStatusStore'];

  private a11yStatusStore: TestManagerOptions['a11yStatusStore'];

  private testProviderStore: TestManagerOptions['testProviderStore'];

  private onError?: TestManagerOptions['onError'];

  private onReady?: TestManagerOptions['onReady'];

  private vitestManager: VitestManager;

  private selectedStoryCountForLastRun = 0;

  constructor(options: TestManagerOptions) {
    this.channel = options.channel;
    this.store = options.store;
    this.componentTestStatusStore = options.componentTestStatusStore;
    this.a11yStatusStore = options.a11yStatusStore;
    this.testProviderStore = options.testProviderStore;
    this.onError = options.onError;
    this.onReady = options.onReady;

    this.vitestManager = new VitestManager(this);

    this.store.subscribe('TRIGGER_RUN', this.handleRunRequest.bind(this));
    this.channel.on(TESTING_MODULE_CANCEL_TEST_RUN_REQUEST, this.handleCancelRequest.bind(this));

    this.store.onStateChange((state, previousState) => {
      if (!isEqual(state.config, previousState.config)) {
        this.handleConfigChange(state.config, previousState.config);
      }
      if (state.watching !== previousState.watching) {
        this.handleWatchModeRequest(state.watching);
      }
    });

    this.vitestManager.startVitest().then(() => options.onReady?.());
  }

  async handleConfigChange(config: StoreState['config'], previousConfig: StoreState['config']) {
    process.env.VITEST_STORYBOOK_CONFIG = JSON.stringify(config);

    if (config.coverage !== previousConfig.coverage) {
      try {
        await this.vitestManager.restartVitest({
          coverage: config.coverage,
        });
      } catch (e) {
        this.reportFatalError('Failed to change coverage configuration', e);
      }
    }
  }

  async handleWatchModeRequest(watching: boolean) {
    const coverage = this.store.getState().config.coverage ?? false;

    if (coverage) {
      try {
        if (watching) {
          // if watch mode is toggled on and coverage is already enabled, restart vitest without coverage to automatically disable it
          await this.vitestManager.restartVitest({ coverage: false });
        } else {
          // if watch mode is toggled off and coverage is already enabled, restart vitest with coverage to automatically re-enable it
          await this.vitestManager.restartVitest({ coverage });
        }
      } catch (e) {
        this.reportFatalError('Failed to change watch mode while coverage was enabled', e);
      }
    }
  }

  async handleRunRequest(event: TriggerRunEvent) {
    try {
      const state = this.store.getState();

      /*
        If we're only running a subset of stories, we have to temporarily disable coverage,
        as a coverage report for a subset of stories is not useful.
      */
      const temporarilyDisableCoverage =
        state.config.coverage && !state.watching && (event.payload.storyIds ?? []).length > 0;
      if (temporarilyDisableCoverage) {
        await this.vitestManager.restartVitest({
          coverage: false,
        });
      } else {
        await this.vitestManager.vitestRestartPromise;
      }

      this.selectedStoryCountForLastRun = event.payload.storyIds?.length ?? 0;

      await this.vitestManager.runTests(event.payload);

      if (temporarilyDisableCoverage) {
        // Re-enable coverage if it was temporarily disabled because of a subset of stories was run
        await this.vitestManager.restartVitest({ coverage: state?.config.coverage });
      }
    } catch (e) {
      this.reportFatalError('Failed to run tests', e);
    }
  }

  async handleCancelRequest(payload: TestingModuleCancelTestRunRequestPayload) {
    try {
      if (payload.providerId !== TEST_PROVIDER_ID) {
        return;
      }

      await this.vitestManager.cancelCurrentRun();
    } catch (e) {
      this.reportFatalError('Failed to cancel tests', e);
    }
  }

  async sendProgressReport(payload: TestingModuleProgressReportPayload) {
    this.channel.emit(TESTING_MODULE_PROGRESS_REPORT, {
      ...payload,
      details: { ...payload.details, selectedStoryCount: this.selectedStoryCountForLastRun },
    });

    const status = 'status' in payload ? payload.status : undefined;
    const progress = 'progress' in payload ? payload.progress : undefined;
    if (
      ((status === 'success' || status === 'cancelled') && progress?.finishedAt) ||
      status === 'failed'
    ) {
      // reset the count when a test run is fully finished
      this.selectedStoryCountForLastRun = 0;
    }
  }

  async reportFatalError(message: string, error: Error | any) {
    this.onError?.(message, error);
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
