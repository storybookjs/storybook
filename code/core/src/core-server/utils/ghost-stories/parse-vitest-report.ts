import { analyzeTestResults } from '../../../shared/utils/analyze-test-results.ts';
import type { StoryTestResult } from '../../../shared/utils/test-result-types.ts';
import { toStoryTestResult } from '../../../shared/utils/to-story-test-result.ts';
import type { TestRunSummary } from './types.ts';

/** Transform the Vitest JSON reporter output to our expected format and return a TestRunSummary */
export function parseVitestResults(report: any): TestRunSummary {
  const storyTestResults: StoryTestResult[] = [];

  for (const testSuite of report.testResults) {
    for (const assertion of testSuite.assertionResults) {
      const result = toStoryTestResult({
        storyId: assertion.meta?.storyId ?? assertion.fullName,
        statusRaw: assertion.status,
        reports: assertion.meta?.reports,
        errors: assertion.failureMessages?.map((message: string) => ({ stack: message })),
      });

      if (result) {
        storyTestResults.push(result);
      }
    }
  }

  return {
    summary: analyzeTestResults(storyTestResults),
  };
}
