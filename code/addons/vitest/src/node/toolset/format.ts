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

/** Result counts, shared with the handler so telemetry reports the numbers the text shows. */
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

function formatFailingStoriesSection(statuses: ComponentTestStatus[]): string {
  const entries = statuses.map(
    (status) =>
      `### ${status.storyId}

${status.description || 'No failure details available.'}`
  );

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

/**
 * Only the sections that carry information are emitted, so a run with nothing to report renders as
 * an empty string.
 */
function formatCompletedRun(
  result: TestRunResult,
  { a11y, origin }: { a11y: boolean; origin?: string }
): string {
  const sections: string[] = [];
  const passingStories = result.componentTestStatuses.filter(isPassing);
  const failingStories = result.componentTestStatuses.filter(isFailing);

  if (passingStories.length > 0) {
    sections.push(formatPassingStoriesSection(passingStories));
  }

  if (failingStories.length > 0) {
    sections.push(formatFailingStoriesSection(failingStories));
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
      return `No stories found matching the provided input.

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
