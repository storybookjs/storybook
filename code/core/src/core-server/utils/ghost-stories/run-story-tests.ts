import { executeCommand, resolvePathInStorybookCache } from 'storybook/internal/common';

import { existsSync } from 'fs';
import { mkdir, readFile } from 'fs/promises';
import { join } from 'path/posix';

import { extractCategorizedErrors } from './categorize-render-errors';
import { type GhostStoriesResponsePayload, type StoryTestResult } from './types';

export async function runStoryTests(
  componentFilePaths: string[]
): Promise<GhostStoriesResponsePayload> {
  try {
    // Create the cache directory for story discovery tests
    const cacheDir = resolvePathInStorybookCache('ghost-stories-tests');
    await mkdir(cacheDir, { recursive: true });

    // Create timestamped output file
    const timestamp = Date.now();
    const outputFile = join(cacheDir, `test-results-${timestamp}.json`);

    // Start timing the command execution
    const startTime = Date.now();
    let testFailureMessage;

    try {
      // Execute the test runner command with specific story files
      const testProcess = executeCommand({
        command: 'npx',
        args: [
          'vitest',
          'run',
          '--reporter=json',
          '--testTimeout=1000',
          `--outputFile=${outputFile}`,
          ...componentFilePaths,
        ],
        stdio: 'pipe',
        env: {
          STORYBOOK_COMPONENT_PATHS: componentFilePaths.join(';'),
        },
      });

      await testProcess;
    } catch (error) {
      const execaError = error as { stdout?: string; stderr?: string };
      const errorMessage = execaError.stderr || String(error);
      testFailureMessage = errorMessage;
    }

    // Calculate duration of the command execution
    const duration = Date.now() - startTime;

    // Read and parse the JSON results
    if (!existsSync(outputFile)) {
      return {
        success: false,
        duration: 0,
        error: testFailureMessage,
      };
    }

    const resultsJson = await readFile(outputFile, 'utf8');
    const testResults = JSON.parse(resultsJson);

    // Transform the Vitest test results to our expected format
    const storyTestResults: StoryTestResult[] = [];
    let passedButEmptyRender = 0;

    for (const testSuite of testResults.testResults) {
      for (const assertion of testSuite.assertionResults) {
        const storyId = assertion.meta?.storyId || assertion.fullName;

        const status =
          assertion.status === 'passed'
            ? 'PASS'
            : assertion.status === 'failed'
              ? 'FAIL'
              : 'PENDING';

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
    const failed = testResults.numFailedTests;
    const successRate = total > 0 ? parseFloat((passed / total).toFixed(2)) : 0;
    const failureRate = total > 0 ? parseFloat((failed / total).toFixed(2)) : 0;
    const successRateWithoutEmptyRender =
      total > 0 ? parseFloat(((passed - passedButEmptyRender) / total).toFixed(2)) : 0;

    // Extract and classify unique errors
    const errorClassification = extractCategorizedErrors(storyTestResults);
    const classifiedErrors = errorClassification.categorizedErrors;

    const testSummary = {
      total,
      passed,
      passedButEmptyRender,
      failed,
      successRate,
      successRateWithoutEmptyRender,
      failureRate,
      uniqueErrorCount: errorClassification.uniqueErrorCount,
      classifiedErrors,
    };

    const enhancedResponse: GhostStoriesResponsePayload = {
      success: testResults.success,
      testSummary,
      duration,
    };

    return enhancedResponse;
  } catch (error) {
    console.error('Error running story tests:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
    };
  }
}
