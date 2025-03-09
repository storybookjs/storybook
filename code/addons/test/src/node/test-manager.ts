import type { Channel } from 'storybook/internal/channels';
import {
  TESTING_MODULE_CANCEL_TEST_RUN_REQUEST,
  TESTING_MODULE_PROGRESS_REPORT,
  TESTING_MODULE_RUN_REQUEST,
  type TestingModuleCancelTestRunRequestPayload,
  type TestingModuleProgressReportPayload,
  type TestingModuleRunRequestPayload,
} from 'storybook/internal/core-events';
import type { experimental_UniversalStore } from 'storybook/internal/core-server';

import { isEqual } from 'es-toolkit';

import { type StoreState, TEST_PROVIDER_ID } from '../constants';
import { VitestManager } from './vitest-manager';

export class TestManager {
  vitestManager: VitestManager;

  selectedStoryCountForLastRun = 0;

  constructor(
    private channel: Channel,
    public store: experimental_UniversalStore<StoreState>,
    private options: {
      onError?: (message: string, error: Error) => void;
      onReady?: () => void;
    } = {}
  ) {
    this.vitestManager = new VitestManager(this);

    this.channel.on(TESTING_MODULE_RUN_REQUEST, this.handleRunRequest.bind(this));
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

  async handleRunRequest(payload: TestingModuleRunRequestPayload) {
    try {
      if (payload.providerId !== TEST_PROVIDER_ID) {
        return;
      }

      const state = this.store.getState();

      /*
        If we're only running a subset of stories, we have to temporarily disable coverage,
        as a coverage report for a subset of stories is not useful.
      */
      const temporarilyDisableCoverage =
        state.config.coverage && !state.watching && (payload.storyIds ?? []).length > 0;
      if (temporarilyDisableCoverage) {
        await this.vitestManager.restartVitest({
          coverage: false,
        });
      } else {
        await this.vitestManager.vitestRestartPromise;
      }

      this.selectedStoryCountForLastRun = payload.storyIds?.length ?? 0;

      await this.vitestManager.runTests(payload);

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
    this.options.onError?.(message, error);
  }

  static async start(
    channel: Channel,
    store: experimental_UniversalStore<StoreState>,
    options: typeof TestManager.prototype.options = {}
  ) {
    return new Promise<TestManager>((resolve) => {
      const testManager = new TestManager(channel, store, {
        ...options,
        onReady: () => {
          resolve(testManager);
          options.onReady?.();
        },
      });
    });
  }
}
