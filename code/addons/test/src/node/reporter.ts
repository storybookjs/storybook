import type { TaskState } from 'vitest';
import type { Vitest } from 'vitest/node';
import { type Reporter } from 'vitest/reporters';

import type {
  TestingModuleProgressReportPayload,
  TestingModuleProgressReportProgress,
} from 'storybook/internal/core-events';

import type { API_StatusUpdate } from '@storybook/types';

import type { Suite } from '@vitest/runner';
// TODO
// We can theoretically avoid the `@vitest/runner` dependency by copying over the necessary
// functions from the `@vitest/runner` package. It is not complex and does not have
// any significant dependencies.
import { getTests } from '@vitest/runner/utils';
import { throttle } from 'es-toolkit';

import { TEST_PROVIDER_ID } from '../constants';
import type { TestManager } from './test-manager';

export type TestResultResult =
  | {
      status: 'success' | 'pending';
      storyId: string;
      testRunId: string;
      duration: number;
    }
  | {
      status: 'failed';
      storyId: string;
      duration: number;
      testRunId: string;
      failureMessages: string[];
    };

export type TestResult = {
  results: TestResultResult[];
  startTime: number;
  endTime: number;
  status: 'passed' | 'failed';
  message?: string;
};

const StatusMap: Record<
  TaskState,
  'passed' | 'failed' | 'skipped' | 'pending' | 'todo' | 'disabled'
> = {
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

  sendReport: (payload: TestingModuleProgressReportPayload) => void;

  constructor(private testManager: TestManager) {
    this.sendReport = throttle((payload) => this.testManager.sendProgressReport(payload), 1000);
  }

  onInit(ctx: Vitest) {
    this.ctx = ctx;
    this.start = Date.now();
  }

  getProgressReport(finishedAt?: number) {
    const files = this.ctx.state.getFiles();
    const fileTests = getTests(files);
    // The number of total tests is dynamic and can change during the run
    const numTotalTests = fileTests.length;

    const numFailedTests = fileTests.filter((t) => t.result?.state === 'fail').length;
    const numPassedTests = fileTests.filter((t) => t.result?.state === 'pass').length;
    const numPendingTests = fileTests.filter(
      (t) => t.result?.state === 'run' || t.mode === 'skip' || t.result?.state === 'skip'
    ).length;
    const testResults: TestResult[] = [];

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

      const assertionResults = tests.flatMap<TestResultResult>((t) => {
        const ancestorTitles: string[] = [];
        let iter: Suite | undefined = t.suite;
        while (iter) {
          ancestorTitles.push(iter.name);
          iter = iter.suite;
        }
        ancestorTitles.reverse();

        const status = StatusMap[t.result?.state || t.mode] || 'skipped';
        const storyId = (t.meta as any).storyId as string;
        const duration = t.result?.duration || 0;
        const testRunId = this.start.toString();

        switch (status) {
          case 'passed':
          case 'pending':
            return [{ status, storyId, duration, testRunId } as TestResultResult];
          case 'failed':
            const failureMessages = t.result?.errors?.map((e) => e.stack || e.message) || [];
            return [{ status, storyId, duration, failureMessages, testRunId } as TestResultResult];
          default:
            return [];
        }
      });

      const hasFailedTests = tests.some((t) => t.result?.state === 'fail');

      testResults.push({
        results: assertionResults,
        startTime,
        endTime,
        status: file.result?.state === 'fail' || hasFailedTests ? 'failed' : 'passed',
        message: file.result?.errors?.[0]?.stack || file.result?.errors?.[0]?.message,
      });
    }

    return {
      cancellable: !finishedAt,
      progress: {
        numFailedTests,
        numPassedTests,
        numPendingTests,
        numTotalTests,
        startedAt: this.start,
        finishedAt,
      } as TestingModuleProgressReportProgress,
      details: {
        testResults,
      },
    };
  }

  async onTaskUpdate() {
    try {
      this.sendReport({
        providerId: TEST_PROVIDER_ID,
        status: 'pending',
        ...this.getProgressReport(),
      });
    } catch (e) {
      this.sendReport({
        providerId: TEST_PROVIDER_ID,
        status: 'failed',
        error:
          e instanceof Error
            ? { name: 'Failed to gather test results', message: e.message, stack: e.stack }
            : { name: 'Failed to gather test results', message: String(e) },
      });
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
    const unhandledErrors = this.ctx.state.getUnhandledErrors();

    const isCancelled = this.ctx.isCancelling;
    const report = this.getProgressReport(Date.now());

    const testSuiteFailures = report.details.testResults.filter(
      (t) => t.status === 'failed' && t.results.length === 0
    );

    const reducedTestSuiteFailures = new Set<string>();

    testSuiteFailures.forEach((t) => {
      reducedTestSuiteFailures.add(t.message);
    });

    if (isCancelled) {
      this.sendReport({
        providerId: TEST_PROVIDER_ID,
        status: 'cancelled',
        ...report,
      });
    } else if (reducedTestSuiteFailures.size > 0 || unhandledErrors.length > 0) {
      const error =
        reducedTestSuiteFailures.size > 0
          ? {
              name: `${reducedTestSuiteFailures.size} component ${reducedTestSuiteFailures.size === 1 ? 'test' : 'tests'} failed`,
              message: Array.from(reducedTestSuiteFailures).reduce(
                (acc, curr) => `${acc}\n${curr}`,
                ''
              ),
            }
          : {
              name: `${unhandledErrors.length} unhandled error${unhandledErrors?.length > 1 ? 's' : ''}`,
              message: unhandledErrors
                .map((e, index) => `[${index}]: ${(e as any).stack || (e as any).message}`)
                .join('\n----------\n'),
            };

      this.sendReport({
        providerId: TEST_PROVIDER_ID,
        status: 'failed',
        details: report.details,
        progress: report.progress,
        error,
      });
    } else {
      this.sendReport({
        providerId: TEST_PROVIDER_ID,
        status: 'success',
        ...report,
      });
    }

    this.clearVitestState();
  }
}
