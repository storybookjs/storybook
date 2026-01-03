import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Channel } from 'storybook/internal/channels';
import { executeCommand, resolvePathInStorybookCache } from 'storybook/internal/common';
import type {
  GeneratedStoryInfo,
  RequestData,
  ResponseData,
  RunStoryTestsResponsePayload,
  StoryDiscoveryProgressPayload,
  StoryDiscoveryRequestPayload,
  StoryDiscoveryResponsePayload,
  StoryTestResult,
} from 'storybook/internal/core-events';
import {
  STORY_DISCOVERY_PROGRESS,
  STORY_DISCOVERY_REQUEST,
  STORY_DISCOVERY_RESPONSE,
} from 'storybook/internal/core-events';
import { telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig, Options } from 'storybook/internal/types';

import { generateSampledStories } from '../utils/story-generation';

export function initStoryDiscoveryChannel(
  channel: Channel,
  options: Options,
  coreOptions: CoreConfig
) {
  /** Listens for events to discover and test stories */
  channel.on(STORY_DISCOVERY_REQUEST, async (data: RequestData<StoryDiscoveryRequestPayload>) => {
    const { sampleSize = 20, globPattern } = data.payload;

    try {
      // First, generate stories from components based on a glob pattern
      console.log('Generating stories...');
      const generationResult = await generateSampledStories({
        sampleSize,
        globPattern,
        options,
      });
      console.log('Stories generated:', generationResult);
      if (!generationResult.success) {
        channel.emit(STORY_DISCOVERY_RESPONSE, {
          success: false,
          id: data.id,
          error: generationResult.error || 'Unknown error occurred',
        } satisfies ResponseData<StoryDiscoveryResponsePayload>);

        if (!coreOptions.disableTelemetry) {
          telemetry('story-discovery', {
            success: false,
            error: generationResult.error,
            sampleSize,
          });
        }
        return;
      }

      // Emit progress for story generation completion
      channel.emit(STORY_DISCOVERY_PROGRESS, {
        phase: 'generating',
        progress: {
          generatedCount: generationResult.generatedStories.length,
        },
      } satisfies StoryDiscoveryProgressPayload);

      // Phase 2: Run tests on generated stories using Vitest
      const storyIds = generationResult.generatedStories.map(
        (story: GeneratedStoryInfo) => story.storyId
      );
      console.log('Running tests on stories:', storyIds);

      const testRunResult = await runStoryTests();

      // Emit progress updates during testing (we'll get updates from the test runner)
      const testSummaryWithPending = {
        ...testRunResult.testSummary,
        pending: 0, // Tests are complete, so no pending tests
      };

      channel.emit(STORY_DISCOVERY_PROGRESS, {
        phase: 'testing',
        progress: {
          testSummary: testSummaryWithPending,
        },
      } satisfies StoryDiscoveryProgressPayload);

      const testResults = {
        results: testRunResult.testResults,
        summary: testSummaryWithPending,
      };

      const allGeneratedStories = generationResult.generatedStories;
      console.log('Test results:', testResults);

      // Extract metrics for telemetry
      const successRate =
        testResults.summary.total > 0 ? testResults.summary.passed / testResults.summary.total : 0;
      const failureRate =
        testResults.summary.total > 0 ? testResults.summary.failed / testResults.summary.total : 0;

      // Extract and deduplicate error messages
      const uniqueErrors = extractUniqueErrors(testRunResult.testResults);

      // Emit final response
      channel.emit(STORY_DISCOVERY_RESPONSE, {
        success: true,
        id: data.id,
        payload: {
          success: testRunResult.success,
          generatedStories: allGeneratedStories,
          testResults: testResults.results,
          testSummary: testResults.summary,
        },
        error: null,
      } satisfies ResponseData<StoryDiscoveryResponsePayload>);

      if (!coreOptions.disableTelemetry) {
        telemetry('story-discovery', {
          success: testRunResult.success,
          generatedCount: allGeneratedStories.length,
          testResults: testResults.summary,
          successRate,
          failureRate,
          uniqueErrors,
          sampleSize,
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('Error generating stories:', errorMessage);
      channel.emit(STORY_DISCOVERY_RESPONSE, {
        success: false,
        id: data.id,
        error: errorMessage,
      } satisfies ResponseData<StoryDiscoveryResponsePayload>);

      if (!coreOptions.disableTelemetry) {
        telemetry('story-discovery', {
          success: false,
          error: errorMessage,
          sampleSize,
        });
      }
    }
  });

  return channel;
}

function extractUniqueErrors(testResults: StoryTestResult[]): string[] {
  const errorSet = new Set<string>();

  for (const result of testResults) {
    if (result.error) {
      // Extract the core error message from the "Message:" section
      const messageMatch = result.error.match(/Message:\s*([^\n-]+)/);
      if (messageMatch && messageMatch[1]) {
        const coreError = messageMatch[1].trim();
        if (coreError) {
          errorSet.add(coreError);
        }
      } else {
        // Fallback: if we can't extract the message, clean and use the whole error
        const cleanedError = result.error
          .replace(/\u001b\[[0-9;]*m/g, '') // Remove ANSI escape codes
          .replace(/\n+/g, ' ') // Replace multiple newlines with single space
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        if (cleanedError) {
          errorSet.add(cleanedError);
        }
      }
    }
  }

  return Array.from(errorSet);
}

async function runStoryTestsTestRunner(): Promise<RunStoryTestsResponsePayload> {
  try {
    // Create the cache directory for story discovery tests
    const cacheDir = resolvePathInStorybookCache('story-discovery-tests');
    await mkdir(cacheDir, { recursive: true });

    // Create timestamped output file
    const timestamp = Date.now();
    const outputFile = join(cacheDir, `test-results-${timestamp}.json`);

    // Start timing the command execution
    const startTime = Date.now();

    try {
      // Execute the test runner command
      const testProcess = executeCommand({
        command: 'npx',
        args: [
          '@storybook/test-runner',
          '--index-json',
          '--json',
          '--includeTags=auto-generated',
          `--outputFile`,
          `"${outputFile}"`,
        ],
        stdio: 'inherit',
      });

      // Wait for the process to complete
      await testProcess;
    } catch {}

    // Calculate duration of the command execution
    const duration = Date.now() - startTime;

    // Read and parse the JSON results
    const resultsJson = await readFile(outputFile, 'utf8');
    const testResults = JSON.parse(resultsJson);

    // Transform the Jest test results to our expected format
    const storyTestResults: StoryTestResult[] = [];

    for (const testSuite of testResults.testResults) {
      for (const assertion of testSuite.assertionResults) {
        // Extract story ID from the test title (assuming format like "Example/Button Default smoke-test")
        const storyId = assertion.ancestorTitles.slice(0, -1).join('/'); // Remove the last part (usually "Default")

        storyTestResults.push({
          storyId,
          status:
            assertion.status === 'passed'
              ? 'PASS'
              : assertion.status === 'failed'
                ? 'FAIL'
                : 'PENDING',
          error: assertion.failureMessages?.join('\n') || undefined,
        });
      }
    }

    const testSummary = {
      total: testResults.numTotalTests,
      passed: testResults.numPassedTests,
      failed: testResults.numFailedTests,
    };

    console.log(
      `Test run completed in ${duration}ms with ${testSummary.passed} passed, ${testSummary.failed} failed out of ${testSummary.total} total tests`
    );

    console.log({ testResults });
    return {
      success: testResults.success,
      testResults: storyTestResults,
      testSummary,
      duration,
    };
  } catch (error) {
    console.error('Error running story tests:', error);

    return {
      success: false,
      testResults: [],
      testSummary: {
        total: 0,
        passed: 0,
        failed: 0,
      },
      error: error instanceof Error ? error.message : String(error),
      duration: 0, // Command didn't complete, so duration is 0
    };
  }
}

async function runStoryTests(): Promise<RunStoryTestsResponsePayload> {
  try {
    // Create the cache directory for story discovery tests
    const cacheDir = resolvePathInStorybookCache('story-discovery-tests');
    await mkdir(cacheDir, { recursive: true });

    // Create timestamped output file
    const timestamp = Date.now();
    const outputFile = join(cacheDir, `test-results-${timestamp}.json`);

    // Start timing the command execution
    const startTime = Date.now();

    try {
      // Execute the test runner command
      const testProcess = executeCommand({
        command: 'npx',
        args: [
          'vitest run',
          '--project=storybook',
          '--reporter=json',
          `--outputFile`,
          `"${outputFile}"`,
        ],
        stdio: 'ignore',
      });

      // Wait for the process to complete
      await testProcess;
    } catch {}

    // Calculate duration of the command execution
    const duration = Date.now() - startTime;

    // Read and parse the JSON results
    const resultsJson = await readFile(outputFile, 'utf8');
    const testResults = JSON.parse(resultsJson);

    console.log({ testResults });

    // Transform the Jest test results to our expected format
    const storyTestResults: StoryTestResult[] = [];

    for (const testSuite of testResults.testResults) {
      for (const assertion of testSuite.assertionResults) {
        // Extract story ID from the test title (assuming format like "Example/Button Default smoke-test")
        const storyId = assertion.ancestorTitles.slice(0, -1).join('/'); // Remove the last part (usually "Default")

        storyTestResults.push({
          storyId,
          status:
            assertion.status === 'passed'
              ? 'PASS'
              : assertion.status === 'failed'
                ? 'FAIL'
                : 'PENDING',
          error: assertion.failureMessages?.join('\n') || undefined,
        });
      }
    }

    const testSummary = {
      total: testResults.numTotalTests,
      passed: testResults.numPassedTests,
      failed: testResults.numFailedTests,
    };

    console.log(
      `Test run completed in ${duration}ms with ${testSummary.passed} passed, ${testSummary.failed} failed out of ${testSummary.total} total tests`
    );

    console.log({ testResults });
    return {
      success: testResults.success,
      testResults: storyTestResults,
      testSummary,
      duration,
    };
  } catch (error) {
    console.error('Error running story tests:', error);

    return {
      success: false,
      testResults: [],
      testSummary: {
        total: 0,
        passed: 0,
        failed: 0,
      },
      error: error instanceof Error ? error.message : String(error),
      duration: 0, // Command didn't complete, so duration is 0
    };
  }
}
