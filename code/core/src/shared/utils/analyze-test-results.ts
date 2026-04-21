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
 * StoryId suffix for a story named `CssCheck` (after Storybook's CSF
 * `toStartCaseStr` + `sanitize`: `CssCheck` → `Css Check` → `css-check`).
 */
const CSS_CHECK_STORY_ID_SUFFIX = '--css-check';

/**
 * Analyze a list of story test results and produce a TestRunAnalysis with pass/fail counts, success
 * rates, empty render detection, and categorized errors.
 */
export function analyzeTestResults(results: StoryTestResult[]): TestRunAnalysis {
  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const passedButEmptyRender = results.filter((r) => r.status === 'PASS' && r.emptyRender).length;

  const successRate = total > 0 ? parseFloat((passed / total).toFixed(2)) : 0;
  const successRateWithoutEmptyRender =
    total > 0 ? parseFloat(((passed - passedButEmptyRender) / total).toFixed(2)) : 0;

  const errorClassification = extractCategorizedErrors(results);

  // `'not-run'` covers both "no CssCheck story in the suite" and "story
  // existed but wasn't executed" — they're the same signal for consumers
  // (no pass/fail outcome available). Collapsing them avoids a fourth
  // state and keeps dashboards from interpreting an absent field.
  const cssCheckMatch = results.find((r) =>
    r.storyId.toLowerCase().endsWith(CSS_CHECK_STORY_ID_SUFFIX)
  );
  const cssCheck: TestRunAnalysis['cssCheck'] =
    cssCheckMatch?.status === 'PASS'
      ? 'pass'
      : cssCheckMatch?.status === 'FAIL'
        ? 'fail'
        : 'not-run';

  return {
    total,
    passed,
    passedButEmptyRender,
    successRate,
    successRateWithoutEmptyRender,
    uniqueErrorCount: errorClassification.uniqueErrorCount,
    categorizedErrors: errorClassification.categorizedErrors,
    cssCheck,
  };
}
