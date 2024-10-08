import type { TaskState } from 'vitest';
import type { Vitest } from 'vitest/node';
import { type Reporter } from 'vitest/reporters';

import type {
  TestingModuleRunAssertionResultPayload,
  TestingModuleRunProgressPayload,
  TestingModuleRunResponsePayload,
  TestingModuleRunTestResultPayload,
} from 'storybook/internal/core-events';

import type { State as InstrumentedState } from '@storybook/instrumenter';
import type { API_StatusUpdate } from '@storybook/types';

import type { Suite } from '@vitest/runner';
// TODO
// We can theoretically avoid the `@vitest/runner` dependency by copying over the necessary
// functions from the `@vitest/runner` package. It is not complex and does not have
// any significant dependencies.
import { getTests } from '@vitest/runner/utils';
// @ts-expect-error we will very soon replace this library with es-toolkit
import throttle from 'lodash/throttle.js';

import { TEST_PROVIDER_ID } from '../constants';
import { sanitizeInstrumentedState } from '../sanitize-instrumented-state';
import type { TestManager } from './test-manager';

type Status = 'passed' | 'failed' | 'skipped' | 'pending' | 'todo' | 'disabled';

function isDefined(value: any): value is NonNullable<typeof value> {
  return value !== undefined && value !== null;
}

const StatusMap: Record<TaskState, Status> = {
  fail: 'failed',
  only: 'pending',
  pass: 'passed',
  run: 'pending',
  skip: 'skipped',
  todo: 'todo',
};

export class StorybookReporter implements Reporter {
  testStatusData: API_StatusUpdate = {};

  start = 0;

  ctx!: Vitest;

  sendReport: (payload: TestingModuleRunProgressPayload) => void;

  constructor(private testManager: TestManager) {
    // @ts-expect-error we will very soon replace this library with es-toolkit
    this.sendReport = throttle((payload) => this.testManager.sendProgressReport(payload), 200);
  }

  onInit(ctx: Vitest) {
    this.ctx = ctx;
    this.start = Date.now();
  }

  getProgressReport(): TestingModuleRunResponsePayload {
    const files = this.ctx.state.getFiles();
    const fileTests = getTests(files);
    // The number of total tests is dynamic and can change during the run
    const numTotalTests = fileTests.length;

    const numFailedTests = fileTests.filter((t) => t.result?.state === 'fail').length;
    const numPassedTests = fileTests.filter((t) => t.result?.state === 'pass').length;
    const numPendingTests = fileTests.filter(
      (t) => t.result?.state === 'run' || t.mode === 'skip' || t.result?.state === 'skip'
    ).length;
    const testResults: Array<TestingModuleRunTestResultPayload> = [];

    for (const file of files) {
      const tests = getTests([file]);
      let startTime = tests.reduce(
        (prev, next) => Math.min(prev, next.result?.startTime ?? Number.POSITIVE_INFINITY),
        Number.POSITIVE_INFINITY
      );
      if (startTime === Number.POSITIVE_INFINITY) {
        startTime = this.start;
      }

      const endTime = tests.reduce(
        (prev, next) =>
          Math.max(prev, (next.result?.startTime ?? 0) + (next.result?.duration ?? 0)),
        startTime
      );

      const assertionResults: TestingModuleRunAssertionResultPayload[] = tests
        .map((t) => {
          const ancestorTitles: string[] = [];
          let iter: Suite | undefined = t.suite;
          while (iter) {
            ancestorTitles.push(iter.name);
            iter = iter.suite;
          }
          ancestorTitles.reverse();

          const status = StatusMap[t.result?.state || t.mode] || 'skipped';
          const storyId = (t.meta as any).storyId;
          const instrumenterData = (t.meta as any).instrumenterState;
          const instrumenterState = instrumenterData?.[storyId];
          // const instrumenterState = sanitizeInstrumentedState(instrumenterData?.[storyId]);

          const metadata: Omit<TestingModuleRunAssertionResultPayload, 'status'> = {
            duration: t.result?.duration || 0,
            storyId,
            data: { instrumenterState },
          };

          if (status === 'passed' || status === 'pending') {
            return {
              status,
              ...metadata,
            };
          }

          if (status === 'failed') {
            return {
              status,
              failureMessages: t.result?.errors?.map((e) => e.stack || e.message) || [],
              ...metadata,
            };
          }

          return null;
        })
        .filter(isDefined);

      const hasFailedTests = tests.some((t) => t.result?.state === 'fail');

      testResults.push({
        results: assertionResults,
        startTime,
        endTime,
        status: file.result?.state === 'fail' || hasFailedTests ? 'failed' : 'passed',
        message: file.result?.errors?.[0]?.message,
      });
    }

    return {
      numFailedTests,
      numPassedTests,
      numPendingTests,
      numTotalTests,
      testResults,
      success: true,
      // TODO
      // It is not simply (numPassedTests + numFailedTests) / numTotalTests
      // because numTotalTests is dyanmic and can change during the run
      // We need to calculate the progress based on the number of tests that have been run
      progress: 0,
      startTime: this.start,
    };
  }

  async onTaskUpdate() {
    try {
      const progress = this.getProgressReport();

      this.sendReport({
        status: 'success',
        payload: progress,
        providerId: TEST_PROVIDER_ID,
      });
    } catch (e) {
      if (e instanceof Error) {
        this.sendReport({
          status: 'failed',
          providerId: TEST_PROVIDER_ID,
          error: {
            name: 'Failed to gather test results',
            message: e.message,
            stack: e.stack,
          },
        });
      } else {
        this.sendReport({
          status: 'failed',
          providerId: TEST_PROVIDER_ID,
          error: {
            name: 'Failed to gather test results',
            message: String(e),
            stack: undefined,
          },
        });
      }
    }
  }

  // TODO
  // Clearing the whole internal state of Vitest might be too aggressive
  // Essentially, we want to reset the calculated total number of tests and the
  // test results when a new test run starts, so that the getProgressReport
  // method can calculate the correct values
  async clearVitestState() {
    this.ctx.state.filesMap.clear();
    this.ctx.state.pathsSet.clear();
    this.ctx.state.idMap.clear();
    this.ctx.state.errorsSet.clear();
    this.ctx.state.processTimeoutCauses.clear();
  }

  async onFinished() {
    this.clearVitestState();
  }
}
