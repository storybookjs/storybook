import type { SerializedError } from 'vitest';
import type { TestCase, TestModule, Vitest } from 'vitest/node';
import type { Reporter } from 'vitest/reporters';

import type { TaskMeta } from '@vitest/runner';
import type { Report } from 'storybook/preview-api';
import { analyzeTestResults, toStoryTestResult } from 'storybook/internal/core-server';
import type { StoryTestResult } from 'storybook/internal/core-server';
import { isExampleStoryId, telemetry } from 'storybook/internal/telemetry';
import type { AgentInfo } from 'storybook/internal/telemetry';

import { mergeAndWriteStoryHistory } from './agent-story-history-cache.ts';
import { getAiSetupRunId } from '../../../../core/src/shared/utils/ai-checklist-flags.ts';

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
  }

  onTestRunStart() {
    this.startTime = Date.now();
  }

  onTestCaseResult(testCase: TestCase) {
    const { storyId, reports } = testCase.meta() as TaskMeta &
      Partial<{ storyId: string; reports: Report[] }>;

    if (!storyId || isExampleStoryId(storyId)) {
      return;
    }

    const testResult = testCase.result();
    const result = toStoryTestResult({
      storyId,
      statusRaw: testResult.state,
      reports,
      errors: testResult.errors,
    });

    if (result) {
      this.testResults.push(result);
    }
  }

  async onTestRunEnd(
    testModules: readonly TestModule[],
    unhandledErrors: readonly SerializedError[]
  ) {
    // Merge the current run into the persisted per-story history (kept on
    // disk only — storyIds never enter telemetry) and use the merged set
    // to compute cumulative stats across runs.
    const cumulativeResults = await mergeAndWriteStoryHistory(this.testResults);
    const analysis = analyzeTestResults(this.testResults, cumulativeResults);
    const duration = Date.now() - this.startTime;

    const testModulesErrors = testModules.flatMap((t) => t.errors());
    const unhandledErrorCount = unhandledErrors.length + testModulesErrors.length;

    const runId = await getAiSetupRunId(this.configDir);

    // Fire and forget — same pattern as the existing test-run telemetry
    telemetry(
      'ai-setup-self-healing-scoring',
      {
        agent: this.agent,
        analysis,
        unhandledErrorCount,
        duration,
        watch: this.ctx.config.watch,
        runId,
      },
      { configDir: this.configDir, stripMetadata: true }
    );

    // Reset for next run (watch mode)
    this.testResults = [];
  }
}
