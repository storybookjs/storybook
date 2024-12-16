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

  async handleConfigChange(payload: TestingModuleConfigChangePayload<Config>) {
    if (payload.providerId !== TEST_PROVIDER_ID) {
      return;
    }

    process.env.VITEST_STORYBOOK_CONFIG = JSON.stringify(payload.config);

    if (this.coverage !== payload.config.coverage) {
      this.coverage = payload.config.coverage;
      try {
        await this.vitestManager.restartVitest({
          coverage: this.coverage,
        });
      } catch (e) {
        const isV8 = e.message?.includes('@vitest/coverage-v8');
        const isIstanbul = e.message?.includes('@vitest/coverage-istanbul');

        if (e.message?.includes('Error: Failed to load url') && (isIstanbul || isV8)) {
          const coveragePackage = isIstanbul ? 'coverage-istanbul' : 'coverage-v8';
          e.message = `Please install the @vitest/${coveragePackage} package to run with coverage`;
        }
        this.reportFatalError('Failed to change coverage mode', e);
      }
    }
  }

  async handleWatchModeRequest(payload: TestingModuleWatchModeRequestPayload<Config>) {
    if (payload.providerId !== TEST_PROVIDER_ID) {
      return;
    }
    this.watchMode = payload.watchMode;

    if (payload.config) {
      this.handleConfigChange({
        providerId: payload.providerId,
        config: payload.config,
      });
    }

    if (this.coverage) {
      try {
        if (payload.watchMode) {
          // if watch mode is toggled on and coverage is already enabled, restart vitest without coverage to automatically disable it
          await this.vitestManager.restartVitest({ coverage: false });
        } else {
          // if watch mode is toggled off and coverage is already enabled, restart vitest with coverage to automatically re-enable it
          await this.vitestManager.restartVitest({ coverage: this.coverage });
        }
      } catch (e) {
        this.reportFatalError('Failed to change watch mode while coverage was enabled', e);
      }
    }
  }

  async handleRunRequest(payload: TestingModuleRunRequestPayload<Config>) {
    try {
      if (payload.providerId !== TEST_PROVIDER_ID) {
        return;
      }

      if (payload.config) {
        this.handleConfigChange({
          providerId: payload.providerId,
          config: payload.config,
        });
      }

      /*
        If we're only running a subset of stories, we have to temporarily disable coverage,
        as a coverage report for a subset of stories is not useful.
      */
      const temporarilyDisableCoverage =
        this.coverage && !this.watchMode && (payload.storyIds ?? []).length > 0;
      if (temporarilyDisableCoverage) {
        await this.vitestManager.restartVitest({
          coverage: false,
        });
      } else {
        await this.vitestManager.vitestRestartPromise;
      }

      await this.vitestManager.runTests(payload);

      if (temporarilyDisableCoverage) {
        // Re-enable coverage if it was temporarily disabled because of a subset of stories was run
        await this.vitestManager.restartVitest({ coverage: this.coverage });
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
