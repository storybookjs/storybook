import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';

import { executeCommand, resolvePathInStorybookCache } from 'storybook/internal/common';

import { join } from 'pathe';

import { extractCategorizedErrors } from './categorize-render-errors';
import { type StoryTestResult, type TestRunSummary } from './types';

export async function runStoryTests(componentFilePaths: string[]): Promise<TestRunSummary> {
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
      const errorMessage = (execaError.stderr || String(error) || '').toLowerCase();
      if (errorMessage.includes('browsertype.launch')) {
        testFailureMessage = 'Playwright is not installed';
      } else if (errorMessage.includes('startup error')) {
        testFailureMessage = 'Startup Error';
      }
    }

    // Calculate duration of the command execution
    const duration = Date.now() - startTime;

    if (testFailureMessage) {
      return {
        success: false,
        duration,
        error: testFailureMessage,
      };
    }

    if (!existsSync(outputFile)) {
      return {
        success: false,
        duration,
        error: 'JSON report not found',
      };
    }

    // Type is the return Vitest JSON report structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let testResults: any;
    try {
      const resultsJson = await readFile(outputFile, 'utf8');
      testResults = JSON.parse(resultsJson);
    } catch {
      return {
        success: false,
        duration,
        error: 'Failed to read or parse JSON report',
      };
    }

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

    // Extract and categorize unique errors
    const errorClassification = extractCategorizedErrors(storyTestResults);
    const categorizedErrors = errorClassification.categorizedErrors;

    const summary = {
      total,
      passed,
      passedButEmptyRender,
      failed,
      successRate,
      successRateWithoutEmptyRender,
      failureRate,
      uniqueErrorCount: errorClassification.uniqueErrorCount,
      categorizedErrors,
    };

    const enhancedResponse: TestRunSummary = {
      success: testResults.success,
      summary,
      duration,
    };

    return enhancedResponse;
  } catch {
    return {
      success: false,
      error: 'Uncaught error running story tests',
      duration: 0,
    };
  }
}
