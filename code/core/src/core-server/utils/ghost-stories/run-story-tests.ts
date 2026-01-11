import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';

import { executeCommand, resolvePathInStorybookCache } from 'storybook/internal/common';

import { join } from 'pathe';

import { parseVitestResults } from './parse-vitest-report';
import type { TestRunSummary } from './types';

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
      } else if (errorMessage.includes('no tests found')) {
        testFailureMessage = 'No tests found';
      } else if (errorMessage.includes('test timeout')) {
        testFailureMessage = 'Test timeout';
      } else if (errorMessage.includes('Unhandled Rejection')) {
        testFailureMessage = 'Unhandled Rejection';
      }
      // TODO: See if we can categorize error and get eror info with stripped data
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

    return parseVitestResults(testResults, duration);
  } catch {
    return {
      success: false,
      error: 'Uncaught error running story tests',
      duration: 0,
    };
  }
}
