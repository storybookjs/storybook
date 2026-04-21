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
   * Whether the `CssCheck` story passed its computed-style assertion.
   *
   * The AI setup prompt asks the agent to author exactly one story named
   * `CssCheck` (storyId suffix `--css-check`) whose `play` asserts a
   * component-specific computed style. That distinguishes "component
   * mounted" from "the user's CSS actually loaded".
   *
   * - `true`  — a `CssCheck` story ran and passed.
   * - `false` — a `CssCheck` story ran and failed.
   * - absent  — no `CssCheck` story in the suite, or the story existed
   *             but was not executed (`PENDING`). The absent case is
   *             treated as "unknown", not as a health signal.
   *
   * Only a boolean is emitted — no storyId or component name — so no
   * user-specific data leaks into telemetry.
   */
  cssCheck?: boolean;
}
