import type { ToolsetCtx } from 'storybook/open-service';

import type { TestRunData, TestRunResult } from './definition.ts';

type ComponentTestStatus = TestRunResult['componentTestStatuses'][number];

/**
 * Shapes of the addon-vitest / addon-a11y payloads that travel over the channel. The run result is
 * not validated on arrival, so these describe what the formatter reads rather than what it is
 * promised — every access below stays defensive for that reason.
 */
type A11yViolationNode = {
  impact?: string;
  failureSummary?: string;
  html?: string;
  linkPath?: string;
};

type A11yViolation = {
  id: string;
  description: string;
  nodes: A11yViolationNode[];
};

type A11yReport = {
  error?: { message: string };
  violations?: unknown;
};

type UnhandledError = {
  name?: string;
  message?: string;
  stack?: string;
  VITEST_TEST_PATH?: string;
  VITEST_TEST_NAME?: string;
};

export type TestRunSummary = {
  passingStoryCount: number;
  failingStoryCount: number;
  a11yViolationCount: number;
  unhandledErrorCount: number;
};

function isPassing(status: ComponentTestStatus): boolean {
  return status.value === 'status-value:success';
}

function isFailing(status: ComponentTestStatus): boolean {
  return status.value === 'status-value:error';
}

function getA11yReports(result: TestRunResult): Record<string, A11yReport[]> {
  return result.a11yReports as Record<string, A11yReport[]>;
}

function getA11yViolations(report: A11yReport): A11yViolation[] {
  if (!('violations' in report)) {
    return [];
  }

  const { violations } = report;
  if (!Array.isArray(violations)) {
    return [];
  }

  return violations.map((violation) => ({
    id: violation.id,
    description: violation.description,
    nodes: violation.nodes.map((node: Record<string, unknown>) => ({
      impact: typeof node.impact === 'string' ? node.impact : undefined,
      failureSummary: typeof node.failureSummary === 'string' ? node.failureSummary : undefined,
      html: typeof node.html === 'string' ? node.html : undefined,
      linkPath: typeof node.linkPath === 'string' ? node.linkPath : undefined,
    })),
  }));
}

function countA11yViolations(a11yReports: Record<string, A11yReport[]>): number {
  let count = 0;

  for (const reports of Object.values(a11yReports ?? {})) {
    for (const report of reports) {
      if ('error' in report && report.error) {
        continue;
      }

      count += getA11yViolations(report).length;
    }
  }

  return count;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

type TestRunFailureCounts = {
  componentTests: number;
  a11yChecks: number;
  unhandledErrors: number;
};

// What fails a completed run, shared with the handler so its outcome matches the report.
export function countTestRunFailures(result: TestRunResult, a11y: boolean): TestRunFailureCounts {
  return {
    componentTests: result.componentTestCount.error,
    a11yChecks: a11y ? result.a11yCount.error : 0,
    unhandledErrors: result.unhandledErrors.length,
  };
}

// Telemetry counts keep their original meaning across versions: `passingStoryCount` counts passing
// component tests even when the report lists the story as failing its accessibility check.
export function summarizeTestRun(result: TestRunResult, a11y: boolean): TestRunSummary {
  return {
    passingStoryCount: result.componentTestStatuses.filter(isPassing).length,
    failingStoryCount: result.componentTestStatuses.filter(isFailing).length,
    a11yViolationCount: a11y ? countA11yViolations(getA11yReports(result)) : 0,
    unhandledErrorCount: result.unhandledErrors.length,
  };
}

function formatPassingStoriesSection(passingStories: ComponentTestStatus[]): string {
  return `## Passing Stories

- ${passingStories.map((status) => status.storyId).join('\n- ')}`;
}

const A11Y_CHECK_FAILED = 'The accessibility check failed; see Accessibility Violations below.';

function formatFailingStoriesSection(
  statuses: ComponentTestStatus[],
  a11yFailingStoryIds: Set<string>
): string {
  const entries = statuses.map((status) => {
    const details = [
      isFailing(status) ? status.description || 'No failure details available.' : undefined,
      a11yFailingStoryIds.has(status.storyId) ? A11Y_CHECK_FAILED : undefined,
    ].filter(Boolean);
    return `### ${status.storyId}

${details.join('\n\n')}`;
  });

  return `## Failing Stories

${entries.join('\n\n')}`;
}

function formatA11yReportsSection({
  a11yReports,
  origin,
}: {
  a11yReports: Record<string, A11yReport[]>;
  origin?: string;
}): string | undefined {
  const a11yViolationSections: string[] = [];

  for (const [storyId, reports] of Object.entries(a11yReports)) {
    for (const report of reports) {
      if ('error' in report && report.error) {
        a11yViolationSections.push(`### ${storyId} - Error

${report.error.message}`);
        continue;
      }

      const violations = getA11yViolations(report);
      if (violations.length === 0) {
        continue;
      }

      for (const violation of violations) {
        const nodes = violation.nodes
          .map((node) => {
            const inspectLink = origin && node.linkPath ? `${origin}${node.linkPath}` : undefined;
            const parts: string[] = [];

            if (node.impact) {
              parts.push(`- **Impact**: ${node.impact}`);
            }

            if (node.failureSummary) {
              parts.push(`  **Message**: ${node.failureSummary}`);
            }

            parts.push(`  **Element**: ${node.html || '(no html available)'}`);

            if (inspectLink) {
              parts.push(`  **Inspect**: ${inspectLink}`);
            }

            return parts.join('\n');
          })
          .join('\n');

        a11yViolationSections.push(`### ${storyId} - ${violation.id}

${violation.description}

#### Affected Elements
${nodes}`);
      }
    }
  }

  if (a11yViolationSections.length === 0) {
    return undefined;
  }

  return `## Accessibility Violations

${a11yViolationSections.join('\n\n')}`;
}

function formatUnhandledErrorsSection(errors: UnhandledError[]): string {
  const formattedErrors = errors.map(
    (unhandledError) =>
      `### ${unhandledError.name || 'Unknown Error'}

**Error message**: ${unhandledError.message || 'No message available'}
**Path**: ${unhandledError.VITEST_TEST_PATH || 'No path available'}
**Test name**: ${unhandledError.VITEST_TEST_NAME || 'No test name available'}
**Stack trace**:
${unhandledError.stack || 'No stack trace available'}`
  );

  return `## Unhandled Errors

${formattedErrors.join('\n\n')}`;
}

function formatA11yResult(result: TestRunResult, a11y: boolean): string {
  if (!a11y) {
    return 'Accessibility: skipped (a11y: false).';
  }
  const { success, warning, error } = result.a11yCount;
  const checked = success + warning + error;
  if (checked === 0) {
    return 'Accessibility: not checked.';
  }
  if (warning === 0 && error === 0) {
    return `Accessibility: ${pluralize(checked, 'story', 'stories')} checked, no violations.`;
  }
  const parts = [
    success > 0 ? `${success} without violations` : undefined,
    warning > 0
      ? `${warning} with violations reported as warnings, which do not fail the run`
      : undefined,
    error > 0 ? `${error} failing the run` : undefined,
  ].filter(Boolean);
  return `Accessibility: ${pluralize(checked, 'story', 'stories')} checked; ${parts.join('; ')}.`;
}

function formatResultSection(result: TestRunResult, a11y: boolean): string {
  const failures = countTestRunFailures(result, a11y);
  const failureParts = [
    failures.componentTests > 0
      ? `${pluralize(failures.componentTests, 'component test')} failed`
      : undefined,
    failures.a11yChecks > 0
      ? `${pluralize(failures.a11yChecks, 'accessibility check')} failed`
      : undefined,
    failures.unhandledErrors > 0
      ? pluralize(failures.unhandledErrors, 'unhandled error')
      : undefined,
  ].filter(Boolean);
  const verdict =
    failureParts.length > 0
      ? `Failed: ${failureParts.join(', ')}.`
      : result.componentTestCount.success === 0
        ? 'No component tests ran.'
        : `Passed: ${pluralize(result.componentTestCount.success, 'component test')} passed.`;

  return `## Result

${verdict}
${formatA11yResult(result, a11y)}`;
}

// Only the sections that carry information are emitted before the closing result.
function formatCompletedRun(
  result: TestRunResult,
  { a11y, origin }: { a11y: boolean; origin?: string }
): string {
  const sections: string[] = [];
  // An error-level accessibility result fails the run without failing the component test, so the
  // story is listed as failing rather than passing.
  const a11yFailingStoryIds = new Set(
    a11y ? result.a11yStatuses.filter(isFailing).map((status) => status.storyId) : []
  );
  const passingStories = result.componentTestStatuses.filter(
    (status) => isPassing(status) && !a11yFailingStoryIds.has(status.storyId)
  );
  const failingStories = result.componentTestStatuses.filter(
    (status) => isFailing(status) || a11yFailingStoryIds.has(status.storyId)
  );

  if (passingStories.length > 0) {
    sections.push(formatPassingStoriesSection(passingStories));
  }

  if (failingStories.length > 0) {
    sections.push(formatFailingStoriesSection(failingStories, a11yFailingStoryIds));
  }

  const a11yReports = getA11yReports(result);
  if (a11y && a11yReports && Object.keys(a11yReports).length > 0) {
    const a11ySection = formatA11yReportsSection({ a11yReports, origin });
    if (a11ySection) {
      sections.push(a11ySection);
    }
  }

  if (result.unhandledErrors.length > 0) {
    sections.push(formatUnhandledErrorsSection(result.unhandledErrors as UnhandledError[]));
  }

  // Last, because agents mostly read this report through `tail`.
  sections.push(formatResultSection(result, a11y));

  return sections.join('\n\n');
}

/**
 * Per-story rendering shared by every transport — the `test-run` MCP tool and the tools CLI.
 *
 * Failed and cancelled runs read as `Error: …` because the MCP tool surfaced them by throwing; the
 * `isError` flag that accompanied them belongs to the adapter, not to text.
 */
export function formatTestRun(data: TestRunData, ctx: ToolsetCtx): string {
  switch (data.status) {
    case 'no-stories':
      return data.notFoundMessages.length === 0
        ? 'No stories were given, so no tests ran. Pass story IDs in `stories`, or omit it to run every story test.'
        : `No stories found matching the provided input.

${data.notFoundMessages.join('\n')}`;
    case 'completed':
      return formatCompletedRun(data.result, { a11y: data.a11y, origin: ctx.origin });
    case 'error':
      return `Error: ${data.error.message}`;
    case 'cancelled':
      return 'Error: Test run was cancelled';
    default: {
      // Type-only: a new outcome must get its own agent-facing text rather than falling through.
      const _exhaustive: never = data;
      return _exhaustive;
    }
  }
}
