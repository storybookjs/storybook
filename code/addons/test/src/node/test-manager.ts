import type { Channel } from 'storybook/internal/channels';
import {
  TESTING_MODULE_CANCEL_TEST_RUN_REQUEST,
  TESTING_MODULE_CONFIG_CHANGE,
  TESTING_MODULE_PROGRESS_REPORT,
  TESTING_MODULE_RUN_REQUEST,
  TESTING_MODULE_WATCH_MODE_REQUEST,
  type TestingModuleCancelTestRunRequestPayload,
  type TestingModuleConfigChangePayload,
  type TestingModuleProgressReportPayload,
  type TestingModuleRunRequestPayload,
  type TestingModuleWatchModeRequestPayload,
} from 'storybook/internal/core-events';

import { type Config, TEST_PROVIDER_ID } from '../constants';
import { VitestManager } from './vitest-manager';

export class TestManager {
  vitestManager: VitestManager;

  watchMode = false;

  coverage = false;

  constructor(
    private channel: Channel,
    private options: {
      onError?: (message: string, error: Error) => void;
      onReady?: () => void;
    } = {}
  ) {
    this.vitestManager = new VitestManager(this);

    this.channel.on(TESTING_MODULE_RUN_REQUEST, this.handleRunRequest.bind(this));
    this.channel.on(TESTING_MODULE_CONFIG_CHANGE, this.handleConfigChange.bind(this));
    this.channel.on(TESTING_MODULE_WATCH_MODE_REQUEST, this.handleWatchModeRequest.bind(this));
    this.channel.on(TESTING_MODULE_CANCEL_TEST_RUN_REQUEST, this.handleCancelRequest.bind(this));

    this.vitestManager.startVitest().then(() => options.onReady?.());
  }

  async restartVitest({ watchMode, coverage }: { watchMode: boolean; coverage: boolean }) {
    await this.vitestManager.vitest?.runningPromise;
    await this.vitestManager.closeVitest();
    await this.vitestManager.startVitest({ watchMode, coverage });
  }

  async handleConfigChange(
    payload: TestingModuleConfigChangePayload<{ coverage: boolean; a11y: boolean }>
  ) {
    if (payload.providerId !== TEST_PROVIDER_ID) {
      return;
    }
    if (this.coverage !== payload.config.coverage) {
      try {
        this.coverage = payload.config.coverage;
        await this.restartVitest({ watchMode: this.watchMode, coverage: this.coverage });
      } catch (e) {
        this.reportFatalError('Failed to change coverage mode', e);
      }
    }
  }

  async handleWatchModeRequest(payload: TestingModuleWatchModeRequestPayload) {
    try {
      if (payload.providerId !== TEST_PROVIDER_ID) {
        return;
      }

      if (this.watchMode !== payload.watchMode) {
        this.watchMode = payload.watchMode;
        await this.restartVitest({ watchMode: this.watchMode, coverage: false });
      }
    } catch (e) {
      this.reportFatalError('Failed to change watch mode', e);
    }
  }

  async handleRunRequest(payload: TestingModuleRunRequestPayload<Config>) {
    try {
      if (payload.providerId !== TEST_PROVIDER_ID) {
        return;
      }
      if (payload.config && this.coverage !== payload.config.coverage) {
        this.coverage = payload.config.coverage;
      }

      const allTestsRun = (payload.storyIds ?? []).length === 0;
      if (this.coverage) {
        /*
           If we have coverage enabled and we're running all stories,
           we have to restart Vitest AND disable watch mode otherwise the coverage report will be incorrect,
           Vitest behaves wonky when re-using the same Vitest instance but with watch mode disabled,
           among other things it causes the coverage report to be incorrect and stale.
           
           If we're only running a subset of stories, we have to temporarily disable coverage,
           as a coverage report for a subset of stories is not useful.
         */
        await this.restartVitest({
          watchMode: allTestsRun ? false : this.watchMode,
          coverage: allTestsRun,
        });
      }

      await this.vitestManager.runTests(payload);

      if (this.coverage && !allTestsRun) {
        // Re-enable coverage if it was temporarily disabled because of a subset of stories was run
        await this.restartVitest({ watchMode: this.watchMode, coverage: this.coverage });
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
    this.channel.emit(TESTING_MODULE_PROGRESS_REPORT, payload);
  }

  async reportFatalError(message: string, error: Error | any) {
    this.options.onError?.(message, error);
  }

  static async start(channel: Channel, options: typeof TestManager.prototype.options = {}) {
    return new Promise<TestManager>((resolve) => {
      const testManager = new TestManager(channel, {
        ...options,
        onReady: () => {
          resolve(testManager);
          options.onReady?.();
        },
      });
    });
  }
}
