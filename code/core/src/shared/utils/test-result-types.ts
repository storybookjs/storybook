export interface StoryTestResult {
  storyId: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  error?: string;
  stack?: string;
  /** Whether the story rendered to an empty/invisible DOM element */
  emptyRender?: boolean;
  /**
   * Whether any user CSS is applied at the canvas root.
   *
   * - `true` — at least one probed computed style differs from the UA default.
   * - `false` — every probed property matches the UA default (likely no user CSS).
   * - `undefined` — the probe could not run or was inconclusive.
   */
  cssApplied?: boolean;
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
  /**
   * Stories that passed but where the CSS-applied probe found no user CSS at the canvas root.
   * Only stories with a positive negative signal are counted — stories without a probe result
   * (e.g. probe didn't run, baseline unavailable) are excluded.
   */
  passedButNoCss: number;
  successRate: number;
  successRateWithoutEmptyRender: number;
  uniqueErrorCount: number;
  categorizedErrors: Record<string, CategorizedError>;
}
