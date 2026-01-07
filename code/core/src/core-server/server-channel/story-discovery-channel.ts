import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { Channel } from 'storybook/internal/channels';
import {
  cache,
  executeCommand,
  getProjectRoot,
  resolvePathInStorybookCache,
} from 'storybook/internal/common';
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
import { getLastEvents, getStorybookMetadata, telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig, Options } from 'storybook/internal/types';

import { getComponentCandidates } from '../utils/story-generation';

const STORY_DISCOVERY_CACHE_KEY = 'experimental/story-discovery/has-run';

export function initStoryDiscoveryChannel(
  channel: Channel,
  options: Options,
  coreOptions: CoreConfig
) {
  if (coreOptions.disableTelemetry) {
    console.log('Skipping discovery run - telemetry disabled');
    return;
  }

  /** Listens for events to discover and test stories */
  channel.on(STORY_DISCOVERY_REQUEST, async (data: RequestData<StoryDiscoveryRequestPayload>) => {
    const { sampleSize = 20, globPattern } = data.payload;
    const generatedStoryFiles: string[] = [];
    let matchCount = 0;
    try {
      // only execute discovery if it's a storybook init run
      // TODO: uncomment this later, it's commented out for debugging purposes
      // const lastEvents = await getLastEvents();
      // if (!lastEvents.init) {
      //   console.log('Skipping discovery run', { lastEvents });
      //   return;
      // }

      const alreadyRan = await cache.get(STORY_DISCOVERY_CACHE_KEY);
      if (alreadyRan) {
        console.log('Skipping discovery run - already ran');
        return;
      }

      const metadata = await getStorybookMetadata(options.configDir);
      const isReactStorybook = metadata?.renderer === '@storybook/react';
      const hasVitestAddon = metadata?.addons && '@storybook/addon-vitest' in metadata.addons;

      // For now this is gated by React + Vitest
      if (!isReactStorybook || !hasVitestAddon) {
        console.log('Skipping discovery run - not react vitest', { metadata });
        return;
      }

      // Mark as ran up-front so we only ever attempt this once
      await cache.set(STORY_DISCOVERY_CACHE_KEY, { timestamp: Date.now() });

      // First, generate stories from components based on a glob pattern
      console.log('Generating stories...');
      const candidatesResult = await getComponentCandidates({
        sampleSize,
        globPattern,
      });
      matchCount = candidatesResult.matchCount;
      console.log('Candidates found:', candidatesResult);
      if (candidatesResult.error) {
        channel.emit(STORY_DISCOVERY_RESPONSE, {
          success: false,
          id: data.id,
          error: candidatesResult.error || 'Unknown error occurred',
        } satisfies ResponseData<StoryDiscoveryResponsePayload>);

        telemetry('story-discovery', {
          success: false,
          error: candidatesResult.error,
          sampleSize,
          matchCount,
        });
        return;
      }

      if (candidatesResult.candidates.length === 0) {
        console.log('No candidates found');
        telemetry('story-discovery', {
          success: false,
          error: 'No candidates found',
          sampleSize,
          matchCount,
        });
        return;
      }

      // Phase 2: Run tests on generated stories using Vitest
      const filesToTest = candidatesResult.candidates.map((candidate) => candidate.file);

      const testRunResult = await runStoryTests(filesToTest);

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

      const allCandidateStories = candidatesResult.candidates.map<GeneratedStoryInfo>(
        (candidate) => ({
          // TODO: fix later
          storyId: candidate.file,
          storyFilePath: candidate.file,
          componentName: candidate.file,
          componentFilePath: candidate.file,
        })
      );
      console.log('Test results:', testResults);

      // Emit final response
      channel.emit(STORY_DISCOVERY_RESPONSE, {
        success: true,
        id: data.id,
        payload: {
          success: testRunResult.success,
          generatedStories: allCandidateStories,
          testResults: testResults.results,
          testSummary: testResults.summary,
        },
        error: null,
      } satisfies ResponseData<StoryDiscoveryResponsePayload>);

      telemetry('story-discovery', {
        success: testRunResult.success,
        generatedCount: allCandidateStories.length,
        testDuration: testRunResult.duration,
        testResults: testResults.summary,
        sampleSize,
        matchCount: candidatesResult.matchCount,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error('Error generating stories:', errorMessage);
      channel.emit(STORY_DISCOVERY_RESPONSE, {
        success: false,
        id: data.id,
        error: errorMessage,
      } satisfies ResponseData<StoryDiscoveryResponsePayload>);

      telemetry('story-discovery', {
        success: false,
        error: errorMessage,
        sampleSize,
        matchCount,
      });
    } finally {
      // Clean up generated story files regardless of success or failure
      if (generatedStoryFiles.length > 0) {
        console.log('Cleaning up generated story files...');
        await Promise.allSettled(
          generatedStoryFiles.map(async (filePath) => {
            try {
              await rm(filePath, { force: true });
              console.log(`Deleted story file: ${filePath}`);
            } catch (cleanupError) {
              console.warn(`Failed to delete story file ${filePath}:`, cleanupError);
            }
          })
        );
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

async function runStoryTests(componentFilePaths: string[]): Promise<RunStoryTestsResponsePayload> {
  try {
    // Create the cache directory for story discovery tests
    const cacheDir = resolvePathInStorybookCache('story-discovery-tests');
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
          '--reporter=default',
          '--reporter=json',
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
      // if a test run fails, we proceed
      testFailureMessage = error instanceof Error ? error.message : String(error);
    }

    // Calculate duration of the command execution
    const duration = Date.now() - startTime;

    // Read and parse the JSON results
    if (!existsSync(outputFile)) {
      return {
        success: false,
        testResults: [],
        duration: 0,
        error: testFailureMessage,
        testSummary: {
          total: 0,
          passed: 0,
          failed: 0,
          failureRate: 0,
          successRate: 0,
          successRateWithoutEmptyRender: 0,
          uniqueErrors: [],
          uniqueErrorCount: 0,
          passingCount: 0,
          failingCount: 0,
          passedButEmptyRenderCount: 0,
          passedComponentPaths: [],
        },
      };
    }

    const resultsJson = await readFile(outputFile, 'utf8');
    const testResults = JSON.parse(resultsJson);

    // Transform the Vitest test results to our expected format
    const storyTestResults: StoryTestResult[] = [];
    let passingCount = 0;
    let failingCount = 0;
    let passedButEmptyRenderCount = 0;
    const passedComponentPaths: string[] = [];

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

        if (status === 'PASS') {
          passingCount++;
          if (hasEmptyRender) {
            passedButEmptyRenderCount++;
          }
          // Collect component paths of passed tests to pass to the frontend
          if (assertion.meta?.componentPath) {
            const root = getProjectRoot();
            // name is the actual story file path
            const storiesFilePath = testSuite.name;
            // and component path is relative e.g. ./Button
            const componentPath = assertion.meta.componentPath.replace('./', '');
            // So we get the directory of the story file and combine with the component path to get the full component path
            const storiesDir = storiesFilePath.substring(0, storiesFilePath.lastIndexOf('/') + 1);
            const fullComponentPath = storiesDir + componentPath;
            // Make the path relative to the project root
            const relativeComponentPath = fullComponentPath.startsWith(root)
              ? fullComponentPath.slice(root.length).replace(/^[\\/]/, '') // Remove leading slash/backslash if present
              : fullComponentPath;
            passedComponentPaths.push(relativeComponentPath);
          }
        } else if (status === 'FAIL') {
          failingCount++;
        }

        // Extract error message (first line of failureMessages)
        let error: string | undefined;
        if (assertion.failureMessages && assertion.failureMessages.length > 0) {
          error = assertion.failureMessages[0].split('\n')[0]; // Take only the first line
        }

        storyTestResults.push({
          storyId,
          status,
          error,
        });
      }
    }

    const total = testResults.numTotalTests;
    const passed = testResults.numPassedTests;
    const failed = testResults.numFailedTests;
    const successRate = total > 0 ? parseFloat((passed / total).toFixed(2)) : 0;
    const failureRate = total > 0 ? parseFloat((failed / total).toFixed(2)) : 0;
    const successRateWithoutEmptyRender =
      total > 0 ? parseFloat(((passed - passedButEmptyRenderCount) / total).toFixed(2)) : 0;

    // Extract unique errors
    const uniqueErrors = extractUniqueErrors(storyTestResults);
    const uniqueErrorCount = uniqueErrors.length;

    // Deduplicate component paths as there could be multiple components in the same file
    const uniquePassedComponentPaths = Array.from(new Set(passedComponentPaths));

    const testSummary = {
      total,
      passed,
      failed,
      // Additional metrics for Vitest
      failureRate,
      successRate,
      successRateWithoutEmptyRender,
      uniqueErrors,
      uniqueErrorCount,
      passingCount,
      failingCount,
      passedButEmptyRenderCount,
      passedComponentPaths: uniquePassedComponentPaths,
    };

    const enhancedResponse: RunStoryTestsResponsePayload = {
      success: testResults.success,
      testResults: storyTestResults,
      testSummary,
      duration,
    };

    return enhancedResponse;
  } catch (error) {
    console.error('Error running story tests:', error);

    return {
      success: false,
      testResults: [],
      testSummary: {
        total: 0,
        passed: 0,
        failed: 0,
        failureRate: 0,
        successRate: 0,
        successRateWithoutEmptyRender: 0,
        uniqueErrors: [],
        uniqueErrorCount: 0,
        passingCount: 0,
        failingCount: 0,
        passedButEmptyRenderCount: 0,
        passedComponentPaths: [],
      },
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
    };
  }
}
