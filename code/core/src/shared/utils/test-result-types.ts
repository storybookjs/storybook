export interface StoryTestResult {
  storyId: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  error?: string;
  stack?: string;
  /** Whether the story rendered to an empty/invisible DOM element */
  emptyRender?: boolean;
}

/**
 * A `StoryTestResult` augmented with the timestamp at which it was recorded.
 * Used by the agent self-healing flow to persist the most recent outcome
 * per story across runs (in cache only — never sent in telemetry).
 */
export interface StoryTestResultHistoryEntry extends StoryTestResult {
  timestamp: number;
}

export type StoryTestResultHistory = Record<string, StoryTestResultHistoryEntry>;

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

/**
 * Outcome of the `CssCheck` story — a story (id suffix `--css-check`)
 * whose `play` asserts a component-specific computed style via
 * `getComputedStyle`. Distinguishes "component mounted" from "the
 * user's CSS actually loaded".
 *
 * - `'pass'`    — a `CssCheck` story ran and passed.
 * - `'fail'`    — a `CssCheck` story ran and failed.
 * - `'not-run'` — no pass/fail signal available: either no `CssCheck`
 *                 story is in the suite, or the story existed but was
 *                 not executed (skipped, pending, todo, filtered out).
 *
 * Only the three-valued enum is emitted — no storyId or component
 * name — so no user-authored data enters telemetry.
 */
export type CssCheckOutcome = 'pass' | 'fail' | 'not-run';

export interface TestRunAnalysis {
  /** Stats for the current run (only stories executed in this run). */
  runTotal: number;
  runPassed: number;
  runPassedButEmptyRender: number;
  runSuccessRate: number;
  runSuccessRateWithoutEmptyRender: number;
  runUniqueErrorCount: number;
  runCategorizedErrors: Record<string, CategorizedError>;
  runCssCheck: CssCheckOutcome;

  /**
   * Stats accumulated across runs: for every story we've ever seen, we
   * keep the most recent outcome (by timestamp). Only emitted by the
   * agent self-healing flow, which is the only consumer that persists
   * a per-story history in the Storybook cache.
   */
  cumulativeTotal?: number;
  cumulativePassed?: number;
  cumulativePassedButEmptyRender?: number;
  cumulativeSuccessRate?: number;
  cumulativeSuccessRateWithoutEmptyRender?: number;
  cumulativeUniqueErrorCount?: number;
  cumulativeCategorizedErrors?: Record<string, CategorizedError>;
  cumulativeCssCheck?: CssCheckOutcome;
}
