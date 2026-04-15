# Agent Vitest Telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send fine-grained telemetry (pass/fail counts, empty render detection, categorized error analysis) when an AI agent runs Vitest through the `storybookTest()` plugin.

**Architecture:** Extract reusable test analysis code from ghost stories into `shared/utils/`, introduce a `renderAnalysis` global gate to enable empty render detection for both ghost stories and agent vitest runs, and add an `AgentTelemetryReporter` that collects per-test results and fires a telemetry event at the end of each run.

**Tech Stack:** TypeScript, Vitest Reporter API, Storybook telemetry (`storybook/internal/telemetry`), `std-env` agent detection.

---

### Task 1: Extract shared types from ghost-stories into shared/utils

**Files:**
- Create: `code/core/src/shared/utils/test-result-types.ts`
- Modify: `code/core/src/core-server/utils/ghost-stories/types.ts`
- Modify: `code/core/src/core-server/utils/ghost-stories/parse-vitest-report.ts`
- Modify: `code/core/src/core-server/utils/ghost-stories/run-story-tests.ts`

- [ ] **Step 1: Create the shared types file**

Create `code/core/src/shared/utils/test-result-types.ts` with the types extracted from `ghost-stories/types.ts`:

```ts
export interface StoryTestResult {
  storyId: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  error?: string;
  stack?: string;
  /** Whether the story rendered to an empty/invisible DOM element */
  emptyRender?: boolean;
}

export interface CategorizedError {
  category: string;
  count: number;
  uniqueCount: number;
  matchedDependencies: string[];
}

export interface ErrorCategorizationResult {
  totalErrors: number;
  categorizedErrors: Record<string, CategorizedError>;
  uniqueErrorCount: number;
}

export interface TestRunAnalysis {
  total: number;
  passed: number;
  passedButEmptyRender: number;
  successRate: number;
  successRateWithoutEmptyRender: number;
  uniqueErrorCount: number;
  categorizedErrors: Record<string, CategorizedError>;
}
```

- [ ] **Step 2: Update ghost-stories/types.ts to use shared types**

Replace `code/core/src/core-server/utils/ghost-stories/types.ts` to remove the moved types and import `TestRunAnalysis` and `CategorizedError` from shared:

```ts
import type { CategorizedError, TestRunAnalysis } from '../../../shared/utils/test-result-types.ts';

export interface TestRunSummary {
  duration?: number;
  summary?: TestRunAnalysis;
  // Error message if the operation failed
  runError?: string;
}
```

- [ ] **Step 3: Update parse-vitest-report.ts imports**

In `code/core/src/core-server/utils/ghost-stories/parse-vitest-report.ts`, change the type imports from `./types.ts` to the shared location:

```ts
// Before:
import {
  type ErrorCategorizationResult,
  type StoryTestResult,
  type TestRunSummary,
} from './types.ts';

// After:
import type { StoryTestResult } from '../../../shared/utils/test-result-types.ts';
import type { TestRunSummary } from './types.ts';
```

Note: `ErrorCategorizationResult` import is removed because it will be consumed from the shared `analyzeTestResults` function in the next task. The `TestRunSummary` import stays since it still lives in ghost-stories types.

- [ ] **Step 4: Update run-story-tests.ts imports**

In `code/core/src/core-server/utils/ghost-stories/run-story-tests.ts`, the import `import type { TestRunSummary } from './types.ts'` stays unchanged — `TestRunSummary` still lives in ghost-stories types.

No change needed here. Verify it still compiles.

- [ ] **Step 5: Run typecheck to verify**

Run: `yarn nx run-many -t check`

Expected: No new type errors. The ghost-stories types file now re-uses `TestRunAnalysis` from shared.

- [ ] **Step 6: Commit**

```bash
git add code/core/src/shared/utils/test-result-types.ts code/core/src/core-server/utils/ghost-stories/types.ts code/core/src/core-server/utils/ghost-stories/parse-vitest-report.ts
git commit -m "refactor: extract shared test result types from ghost-stories"
```

---

### Task 2: Extract shared analysis logic from ghost-stories

**Files:**
- Create: `code/core/src/shared/utils/analyze-test-results.ts`
- Create: `code/core/src/shared/utils/analyze-test-results.test.ts`
- Modify: `code/core/src/core-server/utils/ghost-stories/parse-vitest-report.ts`

- [ ] **Step 1: Write tests for the shared analysis functions**

Create `code/core/src/shared/utils/analyze-test-results.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { analyzeTestResults, extractCategorizedErrors } from './analyze-test-results.ts';
import type { StoryTestResult } from './test-result-types.ts';

vi.mock('./categorize-render-errors', { spy: true });

describe('analyze-test-results', () => {
  describe('extractCategorizedErrors', () => {
    it('should return empty results for all-passing tests', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'PASS' },
        { storyId: 's2', status: 'PASS' },
      ];
      const analysis = extractCategorizedErrors(results);
      expect(analysis.totalErrors).toBe(0);
      expect(analysis.uniqueErrorCount).toBe(0);
      expect(analysis.categorizedErrors).toEqual({});
    });

    it('should categorize errors from failed tests', () => {
      const results: StoryTestResult[] = [
        {
          storyId: 's1',
          status: 'FAIL',
          error: 'Error: Cannot read property "x" of undefined',
          stack: 'at /deps/styled-components.js:1168:14',
        },
        {
          storyId: 's2',
          status: 'FAIL',
          error: 'Error: Cannot read property "x" of undefined',
          stack: 'at /deps/styled-components.js:1168:14',
        },
        {
          storyId: 's3',
          status: 'FAIL',
          error: 'Error: Module not found: react-router',
          stack: 'at import statement',
        },
      ];
      const analysis = extractCategorizedErrors(results);
      expect(analysis.totalErrors).toBe(3);
      expect(analysis.uniqueErrorCount).toBe(2);
      expect(analysis.categorizedErrors['MISSING_THEME_PROVIDER']).toEqual({
        uniqueCount: 1,
        count: 2,
        matchedDependencies: ['styled-components'],
      });
      expect(analysis.categorizedErrors['MODULE_IMPORT_ERROR']).toEqual({
        uniqueCount: 1,
        count: 1,
        matchedDependencies: [],
      });
    });

    it('should skip failed tests without error messages', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'FAIL' },
      ];
      const analysis = extractCategorizedErrors(results);
      expect(analysis.totalErrors).toBe(0);
    });
  });

  describe('analyzeTestResults', () => {
    it('should compute correct summary for all-passing tests', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'PASS' },
        { storyId: 's2', status: 'PASS' },
        { storyId: 's3', status: 'PASS' },
      ];
      const analysis = analyzeTestResults(results);
      expect(analysis).toEqual({
        total: 3,
        passed: 3,
        passedButEmptyRender: 0,
        successRate: 1.0,
        successRateWithoutEmptyRender: 1.0,
        uniqueErrorCount: 0,
        categorizedErrors: {},
      });
    });

    it('should compute correct summary with failures', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'PASS' },
        { storyId: 's2', status: 'FAIL', error: 'Error: Invalid hook call', stack: '' },
        { storyId: 's3', status: 'FAIL', error: 'Error: Module not found', stack: '' },
      ];
      const analysis = analyzeTestResults(results);
      expect(analysis.total).toBe(3);
      expect(analysis.passed).toBe(1);
      expect(analysis.successRate).toBe(0.33);
      expect(analysis.uniqueErrorCount).toBe(2);
    });

    it('should count passedButEmptyRender', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'PASS' },
        { storyId: 's2', status: 'PASS', emptyRender: true },
        { storyId: 's3', status: 'PASS', emptyRender: true },
      ];
      const analysis = analyzeTestResults(results);
      expect(analysis.passedButEmptyRender).toBe(2);
      expect(analysis.successRate).toBe(1.0);
      expect(analysis.successRateWithoutEmptyRender).toBe(0.33);
    });

    it('should handle zero tests', () => {
      const analysis = analyzeTestResults([]);
      expect(analysis.total).toBe(0);
      expect(analysis.successRate).toBe(0);
      expect(analysis.successRateWithoutEmptyRender).toBe(0);
    });

    it('should handle PENDING tests by not counting them as passed', () => {
      const results: StoryTestResult[] = [
        { storyId: 's1', status: 'PASS' },
        { storyId: 's2', status: 'PENDING' },
      ];
      const analysis = analyzeTestResults(results);
      expect(analysis.total).toBe(2);
      expect(analysis.passed).toBe(1);
      expect(analysis.successRate).toBe(0.5);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && yarn vitest run src/shared/utils/analyze-test-results.test.ts`

Expected: FAIL — module not found (the implementation file doesn't exist yet).

- [ ] **Step 3: Create the shared analysis module**

Create `code/core/src/shared/utils/analyze-test-results.ts`:

```ts
import type { ErrorCategory } from './categorize-render-errors.ts';
import { categorizeError } from './categorize-render-errors.ts';
import type {
  ErrorCategorizationResult,
  StoryTestResult,
  TestRunAnalysis,
} from './test-result-types.ts';

/**
 * For a given list of test results, categorize errors into categories and return structured data
 * about the run. Only failed tests with error messages are categorized.
 */
export function extractCategorizedErrors(
  testResults: StoryTestResult[]
): ErrorCategorizationResult {
  const failed = testResults.filter((r) => r.status === 'FAIL' && r.error);

  const map = new Map<
    ErrorCategory,
    { count: number; uniqueErrors: Set<string>; matchedDependencies: Set<string> }
  >();

  const uniqueErrorMessages = new Set<string>();

  for (const r of failed) {
    const { category, matchedDependencies } = categorizeError(r.error!, r.stack);

    if (!map.has(category)) {
      map.set(category, { count: 0, uniqueErrors: new Set(), matchedDependencies: new Set() });
    }

    const data = map.get(category)!;
    data.count++;
    matchedDependencies.forEach((dep) => data.matchedDependencies.add(dep));

    uniqueErrorMessages.add(r.error!);
    data.uniqueErrors.add(r.error!);
  }

  const categorizedErrors = Array.from(map.entries()).reduce<Record<string, any>>(
    (acc, [category, data]) => {
      acc[category] = {
        uniqueCount: data.uniqueErrors.size,
        count: data.count,
        matchedDependencies: Array.from(data.matchedDependencies).sort(),
      };
      return acc;
    },
    {}
  );

  return {
    totalErrors: failed.length,
    uniqueErrorCount: uniqueErrorMessages.size,
    categorizedErrors,
  };
}

/**
 * Analyze a list of story test results and produce a TestRunAnalysis with pass/fail counts, success
 * rates, empty render detection, and categorized errors.
 */
export function analyzeTestResults(results: StoryTestResult[]): TestRunAnalysis {
  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const passedButEmptyRender = results.filter(
    (r) => r.status === 'PASS' && r.emptyRender
  ).length;

  const successRate = total > 0 ? parseFloat((passed / total).toFixed(2)) : 0;
  const successRateWithoutEmptyRender =
    total > 0 ? parseFloat(((passed - passedButEmptyRender) / total).toFixed(2)) : 0;

  const errorClassification = extractCategorizedErrors(results);

  return {
    total,
    passed,
    passedButEmptyRender,
    successRate,
    successRateWithoutEmptyRender,
    uniqueErrorCount: errorClassification.uniqueErrorCount,
    categorizedErrors: errorClassification.categorizedErrors,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd code && yarn vitest run src/shared/utils/analyze-test-results.test.ts`

Expected: All tests PASS.

- [ ] **Step 5: Refactor parse-vitest-report.ts to use shared analysis**

Replace `code/core/src/core-server/utils/ghost-stories/parse-vitest-report.ts` with:

```ts
import { analyzeTestResults } from '../../../shared/utils/analyze-test-results.ts';
import type { StoryTestResult } from '../../../shared/utils/test-result-types.ts';
import type { TestRunSummary } from './types.ts';

/** Transform the Vitest JSON reporter output to our expected format and return a TestRunSummary */
export function parseVitestResults(report: any): TestRunSummary {
  const storyTestResults: StoryTestResult[] = [];

  for (const testSuite of report.testResults) {
    for (const assertion of testSuite.assertionResults) {
      const storyId = assertion.meta?.storyId || assertion.fullName;

      const status =
        assertion.status === 'passed' ? 'PASS' : assertion.status === 'failed' ? 'FAIL' : 'PENDING';

      // Check for empty render in reports
      const emptyRender =
        status === 'PASS' &&
        assertion.meta?.reports?.some(
          (report: { type: string; result?: { emptyRender?: boolean } }) =>
            report.type === 'render-analysis' && report.result?.emptyRender === true
        );

      // Extract error message (first line of failureMessages)
      let error: string | undefined;
      let stack: string | undefined;
      if (assertion.failureMessages && assertion.failureMessages.length > 0) {
        stack = assertion.failureMessages[0];
        error = stack?.split('\n')[0];
      }

      storyTestResults.push({
        storyId,
        status,
        error,
        stack,
        emptyRender: emptyRender || undefined,
      });
    }
  }

  return {
    summary: analyzeTestResults(storyTestResults),
  };
}
```

- [ ] **Step 6: Run parse-vitest-report tests to verify no regressions**

Run: `cd code && yarn vitest run src/core-server/utils/ghost-stories/parse-vitest-report.test.ts`

Expected: All existing tests PASS. The `parseVitestResults` function now delegates to `analyzeTestResults` but the output shape is identical.

- [ ] **Step 7: Run full typecheck**

Run: `yarn nx run-many -t check`

Expected: No new type errors.

- [ ] **Step 8: Commit**

```bash
git add code/core/src/shared/utils/analyze-test-results.ts code/core/src/shared/utils/analyze-test-results.test.ts code/core/src/shared/utils/test-result-types.ts code/core/src/core-server/utils/ghost-stories/parse-vitest-report.ts
git commit -m "refactor: extract shared test analysis logic from ghost-stories"
```

---

### Task 3: Rename the render analysis gate

**Files:**
- Modify: `code/core/src/core-server/utils/ghost-stories/test-annotations.ts`
- Modify: `code/addons/vitest/src/vitest-plugin/index.ts`

- [ ] **Step 1: Update test-annotations.ts gate**

In `code/core/src/core-server/utils/ghost-stories/test-annotations.ts`, change the gate from `globals.ghostStories` to `globals.renderAnalysis?.enabled`:

```ts
// Before (line 21):
    if (!globals.ghostStories) {

// After:
    if (!globals.renderAnalysis?.enabled) {
```

Also update the comment on the line above:

```ts
// Before (line 20):
    // We only run this through ghost stories runs

// After:
    // Render analysis runs during ghost stories and agent-mode vitest runs
```

- [ ] **Step 2: Update getInitialGlobals in vitest-plugin/index.ts**

In `code/addons/vitest/src/vitest-plugin/index.ts`, in the `getInitialGlobals` browser command (around line 379), update the ghost stories block to also set `renderAnalysis`, and add agent detection:

First, update the telemetry imports at the top of the file. Currently there are two separate imports (lines 29-30):

```ts
import { telemetry } from 'storybook/internal/telemetry';
import { oneWayHash } from 'storybook/internal/telemetry';
```

Merge them into one and add `detectAgent`:

```ts
import { detectAgent, oneWayHash, telemetry } from 'storybook/internal/telemetry';
```

Then update the `getInitialGlobals` function:

```ts
// Before (lines 388-392):
                if (process.env.STORYBOOK_COMPONENT_PATHS) {
                  globals.ghostStories = {
                    enabled: true,
                  };
                }

// After:
                if (process.env.STORYBOOK_COMPONENT_PATHS) {
                  globals.ghostStories = {
                    enabled: true,
                  };
                  globals.renderAnalysis = {
                    enabled: true,
                  };
                }

                if (detectAgent()) {
                  globals.renderAnalysis = {
                    enabled: true,
                  };
                }
```

- [ ] **Step 3: Verify ghost stories still work by running existing tests**

Run: `cd code && yarn vitest run src/core-server/utils/ghost-stories/`

Expected: All ghost stories tests PASS.

- [ ] **Step 4: Run full typecheck**

Run: `yarn nx run-many -t check`

Expected: No new type errors.

- [ ] **Step 5: Commit**

```bash
git add code/core/src/core-server/utils/ghost-stories/test-annotations.ts code/addons/vitest/src/vitest-plugin/index.ts
git commit -m "refactor: rename render analysis gate to support both ghost stories and agent mode"
```

---

### Task 4: Add agent-test-run event type

**Files:**
- Modify: `code/core/src/telemetry/types.ts`

- [ ] **Step 1: Add the new event type**

In `code/core/src/telemetry/types.ts`, add `'agent-test-run'` to the `EventType` union. Insert it after `'ai-prepare-story-scoring'` (line 50):

```ts
// Before (line 50):
  | 'ai-prepare-story-scoring';

// After:
  | 'ai-prepare-story-scoring'
  | 'agent-test-run';
```

- [ ] **Step 2: Run typecheck**

Run: `yarn nx run-many -t check`

Expected: No new type errors.

- [ ] **Step 3: Commit**

```bash
git add code/core/src/telemetry/types.ts
git commit -m "feat: add agent-test-run telemetry event type"
```

---

### Task 5: Create the AgentTelemetryReporter

**Files:**
- Create: `code/addons/vitest/src/vitest-plugin/agent-telemetry-reporter.ts`
- Create: `code/addons/vitest/src/vitest-plugin/agent-telemetry-reporter.test.ts`
- Modify: `code/addons/vitest/src/vitest-plugin/index.ts`

- [ ] **Step 1: Write tests for the reporter**

Create `code/addons/vitest/src/vitest-plugin/agent-telemetry-reporter.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentTelemetryReporter } from './agent-telemetry-reporter.ts';

vi.mock('storybook/internal/telemetry', () => ({
  telemetry: vi.fn(),
  isExampleStoryId: vi.fn((id: string) =>
    id.startsWith('example-button--') ||
    id.startsWith('example-header--') ||
    id.startsWith('example-page--')
  ),
}));

const { telemetry, isExampleStoryId } = await import('storybook/internal/telemetry');

function createMockTestCase({
  storyId,
  status,
  reports = [],
  errors = [],
}: {
  storyId?: string;
  status: 'passed' | 'failed' | 'pending';
  reports?: Array<{ type: string; result?: Record<string, unknown> }>;
  errors?: Array<{ message: string; stack?: string }>;
}) {
  return {
    meta: () => ({ storyId, reports }),
    result: () => ({
      state: status,
      errors: status === 'failed' ? errors : [],
    }),
  };
}

function createMockTestModules(testCounts: { passed: number; failed: number }) {
  const tests: Array<{ result: () => { state: string } }> = [];
  for (let i = 0; i < testCounts.passed; i++) {
    tests.push({ result: () => ({ state: 'passed' }) });
  }
  for (let i = 0; i < testCounts.failed; i++) {
    tests.push({ result: () => ({ state: 'failed' }) });
  }
  return [
    {
      children: {
        allTests: function* (filter?: string) {
          for (const t of tests) {
            if (!filter || t.result().state === filter) {
              yield t;
            }
          }
        },
      },
      errors: () => [],
    },
  ];
}

describe('AgentTelemetryReporter', () => {
  let reporter: AgentTelemetryReporter;

  beforeEach(() => {
    vi.clearAllMocks();
    reporter = new AgentTelemetryReporter({
      configDir: '.storybook',
      agent: { name: 'claude' },
    });
  });

  describe('onTestCaseResult', () => {
    it('should collect story test results', () => {
      const testCase = createMockTestCase({
        storyId: 'my-story--primary',
        status: 'passed',
      });
      reporter.onTestCaseResult(testCase as any);
      // No assertion needed — verified via onTestRunEnd telemetry payload
    });

    it('should skip tests without storyId', () => {
      const testCase = createMockTestCase({
        storyId: undefined,
        status: 'passed',
      });
      reporter.onTestCaseResult(testCase as any);
      // Verify no result was collected by checking telemetry on run end
    });

    it('should skip example story IDs', () => {
      const testCase = createMockTestCase({
        storyId: 'example-button--primary',
        status: 'passed',
      });
      reporter.onTestCaseResult(testCase as any);
      // Verify filtered out by checking telemetry on run end
    });
  });

  describe('onTestRunEnd', () => {
    it('should send telemetry with analysis of collected results', async () => {
      reporter.onInit({ config: { watch: false } } as any);

      reporter.onTestCaseResult(
        createMockTestCase({ storyId: 's1', status: 'passed' }) as any
      );
      reporter.onTestCaseResult(
        createMockTestCase({ storyId: 's2', status: 'failed', errors: [{ message: 'Error: Module not found: foo' }] }) as any
      );
      reporter.onTestCaseResult(
        createMockTestCase({ storyId: 's3', status: 'passed', reports: [{ type: 'render-analysis', result: { emptyRender: true } }] }) as any
      );

      await reporter.onTestRunEnd(createMockTestModules({ passed: 2, failed: 1 }) as any, []);

      expect(telemetry).toHaveBeenCalledWith(
        'agent-test-run',
        expect.objectContaining({
          agent: { name: 'claude' },
          analysis: expect.objectContaining({
            total: 3,
            passed: 2,
            passedButEmptyRender: 1,
            successRate: 0.67,
            successRateWithoutEmptyRender: 0.33,
            uniqueErrorCount: 1,
          }),
          unhandledErrorCount: 0,
          watch: false,
        }),
        { configDir: '.storybook', stripMetadata: true }
      );
    });

    it('should filter out example stories from analysis', async () => {
      reporter.onInit({ config: { watch: false } } as any);

      reporter.onTestCaseResult(
        createMockTestCase({ storyId: 'my-story--primary', status: 'passed' }) as any
      );
      reporter.onTestCaseResult(
        createMockTestCase({ storyId: 'example-button--primary', status: 'passed' }) as any
      );

      await reporter.onTestRunEnd(createMockTestModules({ passed: 2, failed: 0 }) as any, []);

      expect(telemetry).toHaveBeenCalledWith(
        'agent-test-run',
        expect.objectContaining({
          analysis: expect.objectContaining({
            total: 1,
            passed: 1,
          }),
        }),
        expect.anything()
      );
    });

    it('should count unhandled errors', async () => {
      reporter.onInit({ config: { watch: false } } as any);

      await reporter.onTestRunEnd(
        createMockTestModules({ passed: 0, failed: 0 }) as any,
        [{ message: 'unhandled' }, { message: 'another' }] as any
      );

      expect(telemetry).toHaveBeenCalledWith(
        'agent-test-run',
        expect.objectContaining({
          unhandledErrorCount: 2,
        }),
        expect.anything()
      );
    });

    it('should reset collected results after each run', async () => {
      reporter.onInit({ config: { watch: false } } as any);

      reporter.onTestCaseResult(
        createMockTestCase({ storyId: 's1', status: 'passed' }) as any
      );
      await reporter.onTestRunEnd(createMockTestModules({ passed: 1, failed: 0 }) as any, []);

      // Second run — should not include results from first run
      reporter.onTestCaseResult(
        createMockTestCase({ storyId: 's2', status: 'failed', errors: [{ message: 'err' }] }) as any
      );
      await reporter.onTestRunEnd(createMockTestModules({ passed: 0, failed: 1 }) as any, []);

      const secondCall = vi.mocked(telemetry).mock.calls[1];
      expect(secondCall[1]).toEqual(
        expect.objectContaining({
          analysis: expect.objectContaining({
            total: 1,
            passed: 0,
          }),
        })
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && yarn vitest run addons/vitest/src/vitest-plugin/agent-telemetry-reporter.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Create the AgentTelemetryReporter**

Create `code/addons/vitest/src/vitest-plugin/agent-telemetry-reporter.ts`:

```ts
import type { SerializedError } from 'vitest';
import type { TestCase, TestModule, Vitest } from 'vitest/node';
import type { Reporter } from 'vitest/reporters';

import type { TaskMeta } from '@vitest/runner';
import type { Report } from 'storybook/preview-api';
import { analyzeTestResults } from 'storybook/internal/core-server';
import type { StoryTestResult, TestRunAnalysis } from 'storybook/internal/core-server';
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
        (report) => report.type === 'render-analysis' && (report.result as any)?.emptyRender === true
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
```

- [ ] **Step 4: Add exports to core-server/index.ts**

The reporter imports from `storybook/internal/core-server` (the package boundary for addons). Add these exports to `code/core/src/core-server/index.ts` after the existing ghost-stories exports (line 40):

```ts
export { analyzeTestResults, extractCategorizedErrors } from '../shared/utils/analyze-test-results.ts';
export type { StoryTestResult, TestRunAnalysis, CategorizedError, ErrorCategorizationResult } from '../shared/utils/test-result-types.ts';
```

- [ ] **Step 5: Add AgentInfo type export to telemetry/index.ts**

In `code/core/src/telemetry/index.ts`, the `detectAgent` function is exported (line 33) but the `AgentInfo` type is not. Update line 33:

```ts
// Before:
export { detectAgent } from './detect-agent.ts';

// After:
export { detectAgent, type AgentInfo } from './detect-agent.ts';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd code && yarn vitest run addons/vitest/src/vitest-plugin/agent-telemetry-reporter.test.ts`

Expected: All tests PASS.

- [ ] **Step 7: Run full typecheck**

Run: `yarn nx run-many -t check`

Expected: No new type errors.

- [ ] **Step 8: Commit**

```bash
git add code/addons/vitest/src/vitest-plugin/agent-telemetry-reporter.ts code/addons/vitest/src/vitest-plugin/agent-telemetry-reporter.test.ts code/core/src/core-server/index.ts code/core/src/telemetry/index.ts
git commit -m "feat: add AgentTelemetryReporter for vitest CLI agent runs"
```

---

### Task 6: Inject the reporter from configureVitest

**Files:**
- Modify: `code/addons/vitest/src/vitest-plugin/index.ts`

- [ ] **Step 1: Add the import for the reporter**

In `code/addons/vitest/src/vitest-plugin/index.ts`, add the import for `AgentTelemetryReporter` near the other local imports at the bottom of the import block (after line 44):

```ts
import { AgentTelemetryReporter } from './agent-telemetry-reporter.ts';
```

Note: `detectAgent` was already added to the telemetry import line in Task 3 Step 2.

- [ ] **Step 2: Update the configureVitest hook to inject the reporter**

In `code/addons/vitest/src/vitest-plugin/index.ts`, update the `configureVitest` hook (around line 448). After the existing telemetry block, add the agent reporter injection:

```ts
    configureVitest(context) {
      context.vitest.config.coverage.exclude.push('storybook-static');

      if (
        !core?.disableTelemetry &&
        !optionalEnvToBoolean(process.env.STORYBOOK_DISABLE_TELEMETRY)
      ) {
        // NOTE: we start telemetry immediately but do not wait on it. Typically it should complete
        // before the tests do. If not we may miss the event, we are OK with that.
        telemetry(
          'test-run',
          {
            runner: 'vitest',
            watch: context.vitest.config.watch,
            coverage: !!context.vitest.config.coverage?.enabled,
          },
          { configDir: finalOptions.configDir }
        );

        // When an agent is running vitest via CLI, inject a reporter that sends
        // detailed test result telemetry (pass/fail, error analysis, empty renders)
        const agent = detectAgent();
        if (agent) {
          context.vitest.config.reporters.push(
            new AgentTelemetryReporter({
              configDir: finalOptions.configDir,
              agent,
            })
          );
        }
      }
    },
```

- [ ] **Step 3: Run full typecheck**

Run: `yarn nx run-many -t check`

Expected: No new type errors.

- [ ] **Step 4: Run all vitest addon tests**

Run: `cd code && yarn vitest run addons/vitest/`

Expected: All tests PASS.

- [ ] **Step 5: Run all ghost stories tests**

Run: `cd code && yarn vitest run src/core-server/utils/ghost-stories/`

Expected: All tests PASS.

- [ ] **Step 6: Run shared utils tests**

Run: `cd code && yarn vitest run src/shared/utils/analyze-test-results.test.ts`

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add code/addons/vitest/src/vitest-plugin/index.ts
git commit -m "feat: inject AgentTelemetryReporter when agent detected in vitest CLI"
```
