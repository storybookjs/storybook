import type { SerializedError } from 'vitest';
import type { TestCase, TestModule, Vitest } from 'vitest/node';
import type { Reporter } from 'vitest/reporters';

import type { TaskMeta } from '@vitest/runner';
import type { Report } from 'storybook/preview-api';
import { analyzeTestResults } from 'storybook/internal/core-server';
import type { StoryTestResult } from 'storybook/internal/core-server';
import { isExampleStoryId, telemetry } from 'storybook/internal/telemetry';
import type { AgentInfo } from 'storybook/internal/telemetry';

interface AgentTelemetryReporterOptions {
  configDir: string;
  agent: AgentInfo;
}

export class AgentTelemetryReporter implements Reporter {
  private ctx!: Vitest;

  private testResults: StoryTestResult[] = [];

  private startTime = Date.now();

  private configDir: string;

  private agent: AgentInfo;

  constructor(options: AgentTelemetryReporterOptions) {
    this.configDir = options.configDir;
    this.agent = options.agent;
  }

  onInit(ctx: Vitest) {
    this.ctx = ctx;
    this.startTime = Date.now();
  }

  onTestCaseResult(testCase: TestCase) {
    const { storyId, reports } = testCase.meta() as TaskMeta &
      Partial<{ storyId: string; reports: Report[] }>;

    // Silently skip non-story tests
    if (!storyId) {
      return;
    }

    // Filter out scaffold example stories
    if (isExampleStoryId(storyId)) {
      return;
    }

    const testResult = testCase.result();
    const status =
      testResult.state === 'passed' ? 'PASS' : testResult.state === 'failed' ? 'FAIL' : 'PENDING';

    // Detect empty render from reports
    const emptyRender =
      status === 'PASS' &&
      reports?.some(
        (report) =>
          report.type === 'render-analysis' && (report.result as any)?.emptyRender === true
      );

    // Extract error message (first line) and stack
    let error: string | undefined;
    let stack: string | undefined;
    if (testResult.errors && testResult.errors.length > 0) {
      const firstError = testResult.errors[0];
      error = firstError.message?.split('\n')[0];
      stack = firstError.stack;
    }

    this.testResults.push({
      storyId,
      status,
      error,
      stack,
      emptyRender: emptyRender || undefined,
    });
  }

  async onTestRunEnd(
    testModules: readonly TestModule[],
    unhandledErrors: readonly SerializedError[]
  ) {
    const analysis = analyzeTestResults(this.testResults);
    const duration = Date.now() - this.startTime;

    const testModulesErrors = testModules.flatMap((t) => t.errors());
    const unhandledErrorCount = unhandledErrors.length + testModulesErrors.length;

    // Fire and forget — same pattern as the existing test-run telemetry
    telemetry(
      'agent-test-run',
      {
        agent: this.agent,
        analysis,
        unhandledErrorCount,
        duration,
        watch: this.ctx.config.watch,
      },
      { configDir: this.configDir, stripMetadata: true }
    );

    // Reset for next run (watch mode)
    this.testResults = [];
    this.startTime = Date.now();
  }
}
