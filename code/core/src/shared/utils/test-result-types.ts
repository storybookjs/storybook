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
  cssCheck: 'pass' | 'fail' | 'not-run';
}
