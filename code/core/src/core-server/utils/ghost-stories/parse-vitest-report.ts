import { analyzeTestResults } from '../../../shared/utils/analyze-test-results.ts';
import type { StoryTestResult } from '../../../shared/utils/test-result-types.ts';
import type { TestRunSummary } from './types.ts';

/** Transform the Vitest JSON reporter output to our expected format and return a TestRunSummary */
export function parseVitestResults(report: any): TestRunSummary {
  const storyTestResults: StoryTestResult[] = [];

  for (const testSuite of report.testResults) {
    for (const assertion of testSuite.assertionResults) {
      const storyId = assertion.meta?.storyId || assertion.fullName;

      const status =
        assertion.status === 'passed' ? 'PASS' : assertion.status === 'failed' ? 'FAIL' : 'PENDING';

      // Check for empty render in reports
      const emptyRender =
        status === 'PASS' &&
        assertion.meta?.reports?.some(
          (report: { type: string; result?: { emptyRender?: boolean } }) =>
            report.type === 'render-analysis' && report.result?.emptyRender === true
        );

      // Extract error message (first line of failureMessages)
      let error: string | undefined;
      let stack: string | undefined;
      if (assertion.failureMessages && assertion.failureMessages.length > 0) {
        stack = assertion.failureMessages[0];
        error = stack?.split('\n')[0];
      }

      storyTestResults.push({
        storyId,
        status,
        error,
        stack,
        emptyRender: emptyRender || undefined,
      });
    }
  }

  return {
    summary: analyzeTestResults(storyTestResults),
  };
}
