import type { TaskState } from 'vitest';
import type { Vitest } from 'vitest/node';
import { type Reporter } from 'vitest/reporters';

import type {
  TestingModuleProgressReportPayload,
  TestingModuleProgressReportProgress,
} from 'storybook/internal/core-events';
import type { Report } from 'storybook/internal/preview-api';

import type { API_StatusUpdate } from '@storybook/types';

import type { Suite } from '@vitest/runner';
import { throttle } from 'es-toolkit';

import { TEST_PROVIDER_ID } from '../constants';
import type { TestManager } from './test-manager';

export type TestStatus = 'passed' | 'failed' | 'warning' | 'pending' | 'skipped';

export type TestResultResult =
  | {
      status: Extract<TestStatus, 'passed' | 'pending'>;
      storyId: string;
      testRunId: string;
      duration: number;
      reports: Report[];
    }
  | {
      status: Extract<TestStatus, 'failed' | 'warning'>;
      storyId: string;
      duration: number;
      testRunId: string;
      failureMessages: string[];
      reports: Report[];
    };

export type TestResult = {
  results: TestResultResult[];
  startTime: number;
  endTime: number;
  status: Extract<TestStatus, 'passed' | 'failed' | 'warning'>;
  message?: string;
};

const statusMap: Record<TaskState, TestStatus> = {
  fail: 'failed',
  only: 'pending',
  pass: 'passed',
  run: 'pending',
  skip: 'skipped',
  todo: 'skipped',
};

export class StorybookReporter implements Reporter {
  testStatusData: API_StatusUpdate = {};

  start = 0;

  ctx!: Vitest;

  sendReport: (payload: TestingModuleProgressReportPayload) => void;

  constructor(public testManager: TestManager) {
    this.sendReport = throttle((payload) => this.testManager.sendProgressReport(payload), 1000);
  }

  onInit(ctx: Vitest) {
    this.ctx = ctx;
    this.start = Date.now();
  }

  async getProgressReport(finishedAt?: number) {
    // TODO
    // We can theoretically avoid the `@vitest/runner` dependency by copying over the necessary
    // functions from the `@vitest/runner` package. It is not complex and does not have
    // any significant dependencies.
    const { getTests } = await import('@vitest/runner/utils');

    const files = this.ctx.state.getFiles();
    const fileTests = getTests(files).filter((t) => t.mode === 'run' || t.mode === 'only');

    // The total number of tests reported by Vitest is dynamic and can change during the run, so we
    // use `storyCountForCurrentRun` instead, based on the list of stories provided in the run request.
    const numTotalTests = finishedAt
      ? fileTests.length
      : Math.max(fileTests.length, this.testManager.vitestManager.storyCountForCurrentRun);

    const numFailedTests = fileTests.filter((t) => t.result?.state === 'fail').length;
    const numPassedTests = fileTests.filter((t) => t.result?.state === 'pass').length;
    const numPendingTests = fileTests.filter((t) => t.result?.state === 'run').length;

    const testResults: TestResult[] = files.map((file) => {
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

      const results = tests.flatMap<TestResultResult>((t) => {
        const ancestorTitles: string[] = [];
        let iter: Suite | undefined = t.suite;
        while (iter) {
          ancestorTitles.push(iter.name);
          iter = iter.suite;
        }
        ancestorTitles.reverse();

        const status = statusMap[t.result?.state || t.mode] || 'skipped';
        const storyId = (t.meta as any).storyId as string;
        const reports =
          ((t.meta as any).reports as Report[])?.map((report) => ({
            status: report.status,
            type: report.type,
          })) ?? [];
        const duration = t.result?.duration || 0;
        const testRunId = this.start.toString();

        switch (status) {
          case 'passed':
          case 'pending':
            return [{ status, storyId, duration, testRunId, reports } as TestResultResult];
          case 'failed':
            const failureMessages = t.result?.errors?.map((e) => e.stack || e.message) || [];
            return [
              {
                status,
                storyId,
                duration,
                failureMessages,
                testRunId,
                reports,
              } as TestResultResult,
            ];
          default:
            return [];
        }
      });

      const hasFailedTests = tests.some((t) => t.result?.state === 'fail');
      return {
        results,
        startTime,
        endTime,
        status: file.result?.state === 'fail' || hasFailedTests ? 'failed' : 'passed',
        message: file.result?.errors?.[0]?.stack || file.result?.errors?.[0]?.message,
      };
    });

    return {
      cancellable: !finishedAt,
      progress: {
        numFailedTests,
        numPassedTests,
        numPendingTests,
        numTotalTests,
        startedAt: this.start,
        finishedAt,
        percentageCompleted: finishedAt
          ? 100
          : numTotalTests
            ? ((numPassedTests + numFailedTests) / numTotalTests) * 100
            : 0,
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
        ...(await this.getProgressReport()),
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

    const report = await this.getProgressReport(Date.now());

    const testSuiteFailures = report.details.testResults.filter(
      (t) => t.status === 'failed' && t.results.length === 0
    );

    const deduplicatedTestSuiteFailures = new Set<string>();

    testSuiteFailures.forEach((t) => {
      deduplicatedTestSuiteFailures.add(t.message);
    });

    const isCancelled = this.ctx.isCancelling;
    const hasTestSuiteFailures = deduplicatedTestSuiteFailures.size > 0;
    const hasUnhandledErrors = unhandledErrors.length > 0;

    if (isCancelled) {
      this.sendReport({
        providerId: TEST_PROVIDER_ID,
        status: 'cancelled',
        ...report,
      });
    } else if (hasTestSuiteFailures || hasUnhandledErrors) {
      const isMultipleSuiteFailures = testSuiteFailures.length === 1;
      const isMultipleDeduplicatedTestSuitesFailures = deduplicatedTestSuiteFailures.size > 1;
      const isMultipleUnhandledErrors = unhandledErrors?.length > 1;

      let error: { name: string; message: string };

      if (hasTestSuiteFailures && hasUnhandledErrors) {
        error = {
          name: `${testSuiteFailures.length} component test${isMultipleSuiteFailures ? 's' : ''} failed, due to ${deduplicatedTestSuiteFailures.size} runtime error${isMultipleDeduplicatedTestSuitesFailures ? 's' : ''} as well as ${unhandledErrors.length} unhandled error${isMultipleUnhandledErrors ? 's' : ''}`,
          message: [
            ...Array.from(deduplicatedTestSuiteFailures),
            ...unhandledErrors.map(
              (e, index) => `[${index}]: ${(e as any).stack || (e as any).message}`
            ),
          ].join('\n----------\n'),
        };
      } else if (hasTestSuiteFailures) {
        error = {
          name: `${testSuiteFailures.length} component test${isMultipleSuiteFailures ? 's' : ''} failed, due to ${deduplicatedTestSuiteFailures.size} runtime error${isMultipleDeduplicatedTestSuitesFailures ? 's' : ''}`,
          message: Array.from(deduplicatedTestSuiteFailures).join('\n----------\n'),
        };
      } else {
        error = {
          name: `${unhandledErrors.length} unhandled error${isMultipleUnhandledErrors ? 's' : ''}`,
          message: unhandledErrors
            .map((e, index) => `[${index}]: ${(e as any).stack || (e as any).message}`)
            .join('\n----------\n'),
        };
      }

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
