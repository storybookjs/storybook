import type { SerializedError } from 'vitest';
import type { TestCase, TestModule, Vitest } from 'vitest/node';
import { type Reporter } from 'vitest/reporters';

import type { TaskMeta } from '@vitest/runner';
import type { Report } from 'storybook/preview-api';

import type { VitestError } from '../types';
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

export class StorybookReporter implements Reporter {
  ctx!: Vitest;

  constructor(public testManager: TestManager) {}

  onInit(ctx: Vitest) {
    this.ctx = ctx;
  }

  onTestCaseResult(testCase: TestCase) {
    const { storyId, reports } = testCase.meta() as TaskMeta &
      Partial<{ storyId: string; reports: Report[] }>;

    const testResult = testCase.result();
    this.testManager.onTestCaseResult({
      storyId,
      testResult,
      reports,
    });
  }

  async onTestRunEnd(
    testModules: readonly TestModule[],
    unhandledErrors: readonly SerializedError[]
  ) {
    const totalTestCount = testModules.flatMap((t) => Array.from(t.children.allTests())).length;
    this.testManager.onTestRunEnd({
      totalTestCount,
      unhandledErrors: unhandledErrors as unknown as VitestError[],
    });

    this.clearVitestState();
  }

  // TODO: Clearing the whole internal state of Vitest might be too aggressive
  async clearVitestState() {
    this.ctx.state.filesMap.clear();
    this.ctx.state.pathsSet.clear();
    this.ctx.state.idMap.clear();
    this.ctx.state.errorsSet.clear();
    this.ctx.state.processTimeoutCauses.clear();
  }
}
