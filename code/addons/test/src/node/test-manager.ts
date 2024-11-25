import type { Channel } from 'storybook/internal/channels';
import {
  TESTING_MODULE_CANCEL_TEST_RUN_REQUEST,
  TESTING_MODULE_PROGRESS_REPORT,
  TESTING_MODULE_RUN_REQUEST,
  TESTING_MODULE_WATCH_MODE_REQUEST,
  type TestingModuleCancelTestRunRequestPayload,
  type TestingModuleProgressReportPayload,
  type TestingModuleRunRequestPayload,
  type TestingModuleWatchModeRequestPayload,
} from 'storybook/internal/core-events';

import { TEST_PROVIDER_ID } from '../constants';
import { VitestManager } from './vitest-manager';

export class TestManager {
  vitestManager: VitestManager;

  watchMode = false;

  constructor(
    private channel: Channel,
    private options: {
      onError?: (message: string, error: Error) => void;
      onReady?: () => void;
    } = {}
  ) {
    this.vitestManager = new VitestManager(channel, this);

    this.channel.on(TESTING_MODULE_RUN_REQUEST, this.handleRunRequest.bind(this));
    this.channel.on(TESTING_MODULE_WATCH_MODE_REQUEST, this.handleWatchModeRequest.bind(this));
    this.channel.on(TESTING_MODULE_CANCEL_TEST_RUN_REQUEST, this.handleCancelRequest.bind(this));

    this.vitestManager.startVitest().then(() => options.onReady?.());
  }

  async restartVitest(watchMode = false) {
    await this.vitestManager.vitest?.runningPromise;
    await this.vitestManager.closeVitest();
    await this.vitestManager.startVitest(watchMode);
  }

  async handleWatchModeRequest(payload: TestingModuleWatchModeRequestPayload) {
    try {
      if (payload.providerId !== TEST_PROVIDER_ID) {
        return;
      }

      if (this.watchMode !== payload.watchMode) {
        this.watchMode = payload.watchMode;
        await this.restartVitest(this.watchMode);
      }
    } catch (e) {
      this.reportFatalError('Failed to change watch mode', e);
    }
  }

  async handleRunRequest(payload: TestingModuleRunRequestPayload) {
    try {
      if (payload.providerId !== TEST_PROVIDER_ID) {
        return;
      }

      await this.vitestManager.runTests(payload);
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
