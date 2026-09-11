import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';

import { executeCommand, resolvePathInStorybookCache } from 'storybook/internal/common';

import { join } from 'pathe';

import { parseVitestResults } from './parse-vitest-report.ts';
import type { TestRunSummary } from './types.ts';

/**
 * Run ghost stories: execute vitest on component file paths to auto-generate
 * and test stories that don't exist on disk.
 *
 * @param componentFilePaths - Absolute paths to component files to test.
 * @param options.cwd - Working directory for vitest. Defaults to process.cwd().
 */
export async function runStoryTests(
  componentFilePaths: string[],
  options?: { cwd?: string; ghostRun?: boolean }
): Promise<TestRunSummary> {
  const cwd = options?.cwd;
  try {
    // Create the cache directory for story discovery tests
    const cacheDir = resolvePathInStorybookCache('story-tests');
    await mkdir(cacheDir, { recursive: true });

    // Create timestamped output file
    const timestamp = Date.now();
    const outputFile = join(cacheDir, `test-results-${timestamp}.json`);

    // Start timing the command execution
    const startTime = Date.now();
    let testFailureMessage;

    try {
      // Execute the test runner command with specific story files.
      //
      // STORYBOOK_INTERNAL_TEST_RUN marks this as a dev-server-initiated run
      // (ghost-stories or ai-setup-final-scoring) so the vitest plugin can
      // skip telemetry meant for agent-driven external runs. Without this,
      // ghost-stories runs would trigger `ai-setup-self-healing-scoring`
      // events whose results have nothing to do with the agent's iterative
      // self-healing loop.
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
        cwd,
        stdio: 'pipe',
        env: {
          STORYBOOK_INTERNAL_TEST_RUN: '1',
          ...(options?.ghostRun ? { STORYBOOK_COMPONENT_PATHS: componentFilePaths.join(';') } : {}),
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
      } else if (errorMessage.includes('react-native-web')) {
        testFailureMessage = 'React Native Web error';
      } else if (errorMessage.includes('unhandled rejection')) {
        testFailureMessage = 'Unhandled Rejection';
      }
    }

    // Calculate duration of the command execution
    const duration = Date.now() - startTime;

    if (testFailureMessage) {
      return {
        duration,
        runError: testFailureMessage,
      };
    }

    if (!existsSync(outputFile)) {
      return {
        duration,
        runError: 'JSON report not found',
      };
    }

    // Type is the return Vitest JSON report structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let vitestReport: any;
    try {
      const resultsJson = await readFile(outputFile, 'utf8');
      vitestReport = JSON.parse(resultsJson);
    } catch {
      return {
        duration,
        runError: 'Failed to read or parse JSON report',
      };
    }

    if (!vitestReport.testResults || vitestReport.testResults.length === 0) {
      return {
        duration,
        runError: 'No tests found',
      };
    }

    return { ...parseVitestResults(vitestReport), duration };
  } catch {
    return {
      runError: 'Uncaught error running story tests',
      duration: 0,
    };
  }
}
