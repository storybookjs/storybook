import type { StoryTestResult } from './test-result-types.ts';

export interface VitestLikeReport {
  type: string;
  result?: { emptyRender?: boolean; cssApplied?: boolean } | unknown;
}

export interface VitestLikeError {
  message?: string;
  stack?: string;
}

export interface VitestLikeInput {
  storyId: string | undefined;
  /** Raw vitest status, e.g. 'passed' | 'failed' | 'skipped' | 'pending' | 'running' | ... */
  statusRaw: string | undefined;
  errors?: readonly VitestLikeError[];
  reports?: readonly VitestLikeReport[];
}

// Matches the "Click to debug" banner prepended by addons/vitest/src/vitest-plugin/setup-file.ts,
// with or without the surrounding ANSI color codes — environments that strip ANSI (CI wrappers,
// NO_COLOR) shouldn't leave the banner as the reported error.
const DEBUG_BANNER_RE = /^\n(?:\x1B\[\d+m)?Click to debug\b[^\n]*\n\n/;

/**
 * Extracts a clean single-line error message from a Vitest error.
 *
 * Strips the Storybook "Click to debug" banner if present, then returns the first line of the
 * message (falling back to the first line of the stack, or `'unknown error'`).
 */
export function extractErrorMessage(
  message: string | undefined,
  stack: string | undefined
): string {
  const rawMessage = (message ?? '').replace(DEBUG_BANNER_RE, '');
  return rawMessage.split('\n')[0] || stack?.split('\n')[0] || 'unknown error';
}

export function detectEmptyRender(reports: readonly VitestLikeReport[] | undefined): boolean {
  return (
    reports?.some(
      (report) =>
        report.type === 'render-analysis' &&
        (report.result as { emptyRender?: boolean } | undefined)?.emptyRender === true
    ) ?? false
  );
}

/**
 * Read the `cssApplied` signal from the first render-analysis report that carries one.
 *
 * Returns `undefined` when no report includes the field — callers should treat this as
 * "no signal" rather than "CSS missing", because the probe may not have run.
 */
export function detectCssApplied(
  reports: readonly VitestLikeReport[] | undefined
): boolean | undefined {
  const report = reports?.find((r) => {
    if (r.type !== 'render-analysis') return false;
    const result = r.result as { cssApplied?: boolean } | undefined;
    return typeof result?.cssApplied === 'boolean';
  });
  return (report?.result as { cssApplied?: boolean } | undefined)?.cssApplied;
}

function normalizeStatus(statusRaw: string | undefined): StoryTestResult['status'] {
  if (statusRaw === 'passed') return 'PASS';
  if (statusRaw === 'failed') return 'FAIL';
  return 'PENDING';
}

/**
 * Convert a Vitest-like input (either a JSON reporter assertion or a runtime TestCase) into a
 * StoryTestResult. Returns null when the input has no storyId — callers can use this to skip
 * non-story tests.
 */
export function toStoryTestResult(input: VitestLikeInput): StoryTestResult | null {
  if (!input.storyId) {
    return null;
  }

  const status = normalizeStatus(input.statusRaw);
  const emptyRender = status === 'PASS' && detectEmptyRender(input.reports);
  const cssApplied = status === 'PASS' ? detectCssApplied(input.reports) : undefined;

  let error: string | undefined;
  let stack: string | undefined;
  if (input.errors && input.errors.length > 0) {
    const firstError = input.errors[0];
    error = extractErrorMessage(firstError.message, firstError.stack);
    stack = firstError.stack ?? firstError.message;
  }

  return {
    storyId: input.storyId,
    status,
    error,
    stack,
    emptyRender: emptyRender || undefined,
    cssApplied,
  };
}
