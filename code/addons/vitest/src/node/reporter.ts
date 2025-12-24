import type { SerializedError } from 'vitest';
import type { TestCase, TestModule, Vitest } from 'vitest/node';
import { type Reporter } from 'vitest/reporters';

import type { TaskMeta } from '@vitest/runner';
import type { Report } from 'storybook/preview-api';

import type { VitestError } from '../types';
import type { TestManager } from './test-manager';

export class StorybookReporter implements Reporter {
  ctx!: Vitest;

  constructor(public testManager: TestManager) {}

  onInit(ctx: Vitest) {
    this.ctx = ctx;
  }

  onTestCaseResult(testCase: TestCase) {
    const { storyId, reports, componentPath } = testCase.meta() as TaskMeta &
      Partial<{ storyId: string; reports: Report[]; componentPath: string }>;

    const testResult = testCase.result();
    this.testManager.onTestCaseResult({
      storyId,
      testResult,
      reports,
      componentPath,
    });
  }

  async onTestRunEnd(
    testModules: readonly TestModule[],
    unhandledErrors: readonly SerializedError[]
  ) {
    const totalTestCount = testModules.flatMap((t) =>
      Array.from(t.children.allTests('passed')).concat(Array.from(t.children.allTests('failed')))
    ).length;
    const testModulesErrors = testModules.flatMap((t) => t.errors());
    const serializedErrors = unhandledErrors.concat(testModulesErrors).map((e) => {
      return {
        ...e,
        name: e.name,
        message: e.message,
        stack: e.stack?.replace(e.message, ''),
        cause: e.cause,
      };
    });
    this.testManager.onTestRunEnd({
      totalTestCount,
      unhandledErrors: serializedErrors as unknown as VitestError[],
    });

    this.clearVitestState();
  }

  // TODO: Clearing the whole internal state of Vitest might be too aggressive
  async clearVitestState() {
    this.ctx.state.filesMap.clear();
    this.ctx.state.pathsSet.clear();
    this.ctx.state.idMap.clear();
    this.ctx.state.errorsSet.clear();
    // TODO: Remove this once we don't support Vitest < 4
    // @ts-expect-error processTimeoutCauses does not exist in Vitest 4
    this.ctx.state.processTimeoutCauses?.clear();
  }
}
