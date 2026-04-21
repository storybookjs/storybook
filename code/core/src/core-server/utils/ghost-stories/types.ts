import type { StoryTestResult, TestRunAnalysis } from '../../../shared/utils/test-result-types.ts';

export interface TestRunSummary {
  duration?: number;
  summary?: TestRunAnalysis;
  /**
   * Individual story test results, in emission order from the Vitest JSON reporter
   * (per-file, then per-assertion within each file).
   *
   * Callers that need per-story status (for example, checking the pass/fail of a well-known
   * story such as `CssCheck`) can read from here; the aggregated `summary` stays unchanged.
   */
  storyResults?: StoryTestResult[];
  // Error message if the operation failed
  runError?: string;
}
