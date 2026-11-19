import type { ToolsetCtx } from 'storybook/open-service';

import { isAbsolute, relative } from 'pathe';

import type { TestRunData, TestRunResult, TestRunSelection } from './definition.ts';

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

// A story whose component test fails gets no accessibility result, so it fails for one reason.
function formatFailingStoriesSection(statuses: ComponentTestStatus[]): string {
  const entries = statuses.map((status) => {
    const details = isFailing(status)
      ? status.description || 'No failure details available.'
      : A11Y_CHECK_FAILED;
    return `### ${status.storyId}

${details}`;
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

function formatA11yCounts(
  { success, warning, error }: TestRunResult['a11yCount'],
  a11yEnabled: boolean
): string {
  const checked = success + warning + error;
  if (checked === 0) {
    // Without addon-a11y every run ends here, so the reason keeps it from reading as a fault.
    return a11yEnabled
      ? 'Accessibility: not checked.'
      : 'Accessibility: not checked (addon-a11y is not enabled).';
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

function formatA11yResult(
  result: TestRunResult,
  { a11y, a11yEnabled }: { a11y: boolean; a11yEnabled: boolean }
): string {
  if (!a11y) {
    return 'Accessibility: skipped (a11y: false).';
  }
  const counts = formatA11yCounts(result.a11yCount, a11yEnabled);
  // Otherwise "no violations" reads as if the failing stories were clean too.
  return result.componentTestCount.error > 0
    ? `${counts} Stories with a failing component test get no accessibility result.`
    : counts;
}

// Keyed by every failure count, so a new way to fail a run cannot be left out of the verdict.
const FAILURE_LABELS: Record<keyof TestRunFailureCounts, (count: number) => string> = {
  componentTests: (count) => `${pluralize(count, 'component test')} failed`,
  a11yChecks: (count) => `${pluralize(count, 'accessibility check')} failed`,
  unhandledErrors: (count) => pluralize(count, 'unhandled error'),
};

// Short relative paths read better and cost fewer tokens; a path outside the project stays absolute.
export function displayPath(file: string): string {
  if (!isAbsolute(file)) {
    return file;
  }
  const fromCwd = relative(process.cwd(), file);
  return fromCwd.startsWith('..') ? file : fromCwd;
}

function code(value: string): string {
  return `\`${value}\``;
}

function sinceRef({ since }: NonNullable<TestRunSelection['changed']>): string {
  return since === undefined ? '' : ` since ${code(since)}`;
}

// The notes `stories changed` gives about what its story list cannot show.
function formatChangedConfigFiles(changed: TestRunSelection['changed']): string[] {
  return [
    ...(changed?.pendingFiles.length
      ? [
          `Change detection has not caught up with these changed files yet, so their stories may be missing: ${changed.pendingFiles.map(code).join(', ')}. Run this again in a moment.`,
        ]
      : []),
    ...(changed?.changedConfigFiles.length
      ? [
          `Changed files in the Storybook config directory, which can affect every story: ${changed.changedConfigFiles.map(code).join(', ')}.`,
        ]
      : []),
  ];
}

// One line: what each form matched, then what that selected.
function formatSelection(selection: TestRunSelection): string | undefined {
  const parts: string[] = [];
  if (selection.files) {
    const { filters, storyFileCount } = selection.files;
    parts.push(
      `${pluralize(storyFileCount, 'story file')} ${storyFileCount === 1 ? 'matches' : 'match'} ${filters.map((filter) => code(displayPath(filter))).join(', ')}`
    );
  }
  if (selection.changed) {
    parts.push(
      `${pluralize(selection.changed.storyCount, 'changed story', 'changed stories')}${sinceRef(selection.changed)}`
    );
  }
  const selected = selection.storyCount;
  if (parts.length === 0 || selected === undefined) {
    // `stories` alone: the ids say what was selected, and the verdict counts what ran.
    return undefined;
  }
  return `${parts.join('; ')}: selected ${pluralize(selected, 'story', 'stories')}.`;
}

const A11Y_GUIDANCE =
  'Accessibility violations: fix only what your change caused, and report the rest. For visual ones such as color contrast, ask before changing the design.';

function formatResultSection(
  result: TestRunResult,
  {
    a11y,
    a11yEnabled,
    selection,
    notFound = [],
  }: {
    a11y: boolean;
    a11yEnabled: boolean;
    selection?: TestRunSelection;
    notFound?: string[];
  }
): string {
  const failures = countTestRunFailures(result, a11y);
  const testFailureParts = (Object.keys(FAILURE_LABELS) as (keyof TestRunFailureCounts)[])
    .filter((key) => failures[key] > 0)
    .map((key) => FAILURE_LABELS[key](failures[key]));
  const failureParts = [
    ...(notFound.length > 0 ? [`${pluralize(notFound.length, 'argument')} not used`] : []),
    ...testFailureParts,
  ];
  const passed = result.componentTestCount.success;
  const verdict =
    failureParts.length > 0
      ? `Failed: ${failureParts.join(', ')}${passed > 0 && testFailureParts.length === 0 ? `; ${pluralize(passed, 'component test')} passed` : ''}.`
      : passed === 0
        ? 'No component tests ran.'
        : `Passed: ${pluralize(passed, 'component test')} passed.`;

  const lines = [
    ...[selection && formatSelection(selection)].filter((line): line is string => Boolean(line)),
    ...formatChangedConfigFiles(selection?.changed),
    ...notFound,
    verdict,
    formatA11yResult(result, { a11y, a11yEnabled }),
    ...(a11y && countA11yViolations(getA11yReports(result)) > 0 ? [A11Y_GUIDANCE] : []),
  ];
  return `## Result

${lines.join('\n')}`;
}

// Only the sections that carry information are emitted before the closing result.
function formatCompletedRun(
  result: TestRunResult,
  {
    a11y,
    a11yEnabled,
    selection,
    notFound,
    ctx,
  }: {
    a11y: boolean;
    a11yEnabled: boolean;
    selection?: TestRunSelection;
    notFound?: string[];
    ctx: ToolsetCtx;
  }
): string {
  const { origin } = ctx;
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

  // Last, because agents mostly read this report through `tail`.
  sections.push(formatResultSection(result, { a11y, a11yEnabled, selection, notFound }));

  return sections.join('\n\n');
}

// How to spell an argument for the transport the agent uses.
function argument(ctx: ToolsetCtx, cli: string, mcp: string): string {
  return code(ctx.transport === 'cli' ? cli : mcp);
}

function formatNoStories(
  { notFoundMessages, selection }: Extract<TestRunData, { status: 'no-stories' }>,
  ctx: ToolsetCtx
): string {
  if (notFoundMessages.length > 0) {
    return `No stories found matching the provided input.

${notFoundMessages.join('\n')}`;
  }
  if (selection?.files?.storyFileCount === 0) {
    // Only under `changed`, which passes with no tests, as in Vitest; otherwise it failed above.
    return `No story files found for ${selection.files.filters.map((filter) => code(displayPath(filter))).join(', ')}, so no tests ran.`;
  }
  if (selection?.changed) {
    const what = `${
      selection.changed.storyCount > 0
        ? 'None of the selected stories changed'
        : 'No stories changed'
    }${sinceRef(selection.changed)}`;
    // A run that selected nothing passes, as in Vitest; the last line names what the caller has not
    // passed yet. Without a ref only the uncommitted changes count, so after a commit nothing has
    // changed.
    const more = [
      ...(selection.changed.since === undefined
        ? [`a ref (${argument(ctx, '--changed main', 'changed: "main"')})`]
        : []),
      ...(selection.files ? [] : ['story files']),
    ];
    return [
      `${what}, so no tests ran.`,
      ...formatChangedConfigFiles(selection.changed),
      ...(more.length > 0 ? [`To test more, pass ${more.join(' or ')}.`] : []),
    ].join('\n');
  }
  if (selection?.files && selection.inputStoryCount) {
    return 'None of the given story IDs is in the matched story files, so no tests ran.';
  }
  return 'No stories were given, so no tests ran.';
}

/**
 * Per-story rendering shared by every transport — the `test-run` MCP tool and the tools CLI.
 *
 * Failed and cancelled runs read as `Error: …` because the MCP tool surfaced them by throwing; the
 * `isError` flag that accompanied them belongs to the adapter, not to text.
 */
export function formatTestRun(
  data: TestRunData,
  ctx: ToolsetCtx,
  { a11yEnabled }: { a11yEnabled: boolean }
): string {
  switch (data.status) {
    case 'no-stories':
      return formatNoStories(data, ctx);
    case 'completed':
      return formatCompletedRun(data.result, {
        a11y: data.a11y,
        a11yEnabled,
        selection: data.selection,
        notFound: data.notFoundMessages,
        ctx,
      });
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
