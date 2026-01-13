import type { ErrorCategory } from '../../../shared/utils/categorize-render-errors';
import { categorizeError } from '../../../shared/utils/categorize-render-errors';
import { type ErrorCategorizationResult, type StoryTestResult, type TestRunSummary } from './types';

/**
 * For a given list of test results:
 *
 * - Go through failures
 * - Categorize errors into categories
 * - Return structured data about the run, with categorized errors instead of the actual error
 *   messages
 */
function extractCategorizedErrors(testResults: StoryTestResult[]): ErrorCategorizationResult {
  const failed = testResults.filter((r) => r.status === 'FAIL' && r.error);

  // Map: category -> { count, uniqueErrors: Set<string>, matchedDependencies }
  const map = new Map<
    ErrorCategory,
    { count: number; uniqueErrors: Set<string>; matchedDependencies: Set<string> }
  >();

  // To count unique error messages (by their message, not by category)
  const uniqueErrorMessages = new Set<string>();

  for (const r of failed) {
    const { category, matchedDependencies } = categorizeError(r.error!, r.stack);

    if (!map.has(category)) {
      map.set(category, { count: 0, uniqueErrors: new Set(), matchedDependencies: new Set() });
    }

    const data = map.get(category)!;
    data.count++;
    matchedDependencies.forEach((dep) => data.matchedDependencies.add(dep));

    // Use the full error message for unique error message counting
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

/** Transform the Vitest test results to our expected format and return a TestRunSummary */
export function parseVitestResults(testResults: any): TestRunSummary {
  // Transform the Vitest test results to our expected format
  const storyTestResults: StoryTestResult[] = [];
  let passedButEmptyRender = 0;

  for (const testSuite of testResults.testResults) {
    for (const assertion of testSuite.assertionResults) {
      const storyId = assertion.meta?.storyId || assertion.fullName;

      const status =
        assertion.status === 'passed' ? 'PASS' : assertion.status === 'failed' ? 'FAIL' : 'PENDING';

      // Check for empty render in reports
      const hasEmptyRender = assertion.meta?.reports?.some(
        (report: { type: string; result?: { emptyRender?: boolean } }) =>
          report.type === 'render-analysis' && report.result?.emptyRender === true
      );

      if (status === 'PASS' && hasEmptyRender) {
        passedButEmptyRender++;
      }

      // Extract error message (first line of failureMessages)
      let error: string | undefined;
      let stack: string | undefined;
      if (assertion.failureMessages && assertion.failureMessages.length > 0) {
        stack = assertion.failureMessages[0];
        error = stack?.split('\n')[0]; // Take only the first line
      }

      storyTestResults.push({
        storyId,
        status,
        error,
        stack,
      });
    }
  }

  const total = testResults.numTotalTests;
  const passed = testResults.numPassedTests;
  const successRate = total > 0 ? parseFloat((passed / total).toFixed(2)) : 0;
  const successRateWithoutEmptyRender =
    total > 0 ? parseFloat(((passed - passedButEmptyRender) / total).toFixed(2)) : 0;

  // Extract and categorize unique errors
  const errorClassification = extractCategorizedErrors(storyTestResults);
  const categorizedErrors = errorClassification.categorizedErrors;

  return {
    summary: {
      total,
      passed,
      passedButEmptyRender,
      successRate,
      successRateWithoutEmptyRender,
      uniqueErrorCount: errorClassification.uniqueErrorCount,
      categorizedErrors,
    },
  };
}
