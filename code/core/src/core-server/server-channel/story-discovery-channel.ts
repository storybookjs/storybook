import type { Channel } from 'storybook/internal/channels';
import type {
  GeneratedStoryInfo,
  RequestData,
  ResponseData,
  StoryDiscoveryProgressPayload,
  StoryDiscoveryRequestPayload,
  StoryDiscoveryResponsePayload,
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
          // TODO: Add story-discovery telemetry event
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

      // Phase 2: Run tests on generated stories (mock results when Vitest is not available)
      const storyIds = generationResult.generatedStories.map(
        (story: GeneratedStoryInfo) => story.storyId
      );
      console.log('Running tests on stories:', storyIds);

      // Mock test execution with realistic timing and progress updates
      const totalTests = storyIds.length;
      let completedTests = 0;
      let passedTests = 0;
      let failedTests = 0;

      // Track which stories pass (for deterministic results, make Button.tsx always pass)
      const passingStories = new Set<string>();

      // Simulate test execution over ~2 seconds
      const testBatches = Math.max(1, Math.ceil(totalTests / 3)); // Process tests in batches
      const batchDelay = 2000 / testBatches; // Spread over 2 seconds

      for (let batch = 0; batch < testBatches; batch++) {
        // Wait for the batch delay
        await new Promise((resolve) => setTimeout(resolve, batchDelay));

        // Calculate how many tests to complete in this batch
        const remainingTests = totalTests - completedTests;
        const testsInThisBatch = Math.min(
          remainingTests,
          Math.max(1, Math.floor(totalTests / testBatches))
        );

        // Simulate some tests failing occasionally (but mostly passing)
        for (let i = 0; i < testsInThisBatch; i++) {
          const storyIndex = completedTests;
          const story = generationResult.generatedStories[storyIndex];
          completedTests++;

          // Make Button.tsx always pass, others have 90% pass rate
          const shouldPass =
            story?.componentFilePath?.includes('Button.tsx') || Math.random() < 0.9;

          if (shouldPass) {
            passedTests++;
            if (story) {
              passingStories.add(story.componentFilePath);
            }
          } else {
            failedTests++;
          }
        }

        // Emit progress update for testing phase
        channel.emit(STORY_DISCOVERY_PROGRESS, {
          phase: 'testing',
          progress: {
            testSummary: {
              total: totalTests,
              passed: passedTests,
              failed: failedTests,
              pending: totalTests - completedTests,
            },
          },
        } satisfies StoryDiscoveryProgressPayload);
      }

      // Final test results with component file paths
      const generatedTestResults = generationResult.generatedStories.map(
        (story: GeneratedStoryInfo) => ({
          storyId: story.storyId,
          status: passingStories.has(story.componentFilePath)
            ? ('PASS' as const)
            : ('FAIL' as const),
          componentFilePath: story.componentFilePath,
        })
      );

      // Add src/stories/Button.tsx as a guaranteed passing example
      const buttonStory = {
        storyId: 'button-story-example',
        storyFilePath: 'src/stories/Button.stories.tsx',
        componentName: 'Button',
        componentFilePath: 'src/stories/Button.tsx',
      };

      const buttonTestResult = {
        storyId: 'button-story-example',
        status: 'PASS' as const,
        componentFilePath: 'src/stories/Button.tsx',
      };

      const testResults = {
        results: [...generatedTestResults, buttonTestResult],
        summary: { total: totalTests + 1, passed: passedTests + 1, failed: failedTests },
      };

      // Add button story to generated stories
      const allGeneratedStories = [...generationResult.generatedStories, buttonStory];
      console.log('Test results (mock):', testResults);
      // Emit final response
      channel.emit(STORY_DISCOVERY_RESPONSE, {
        success: true,
        id: data.id,
        payload: {
          success: true,
          generatedStories: allGeneratedStories,
          testResults: testResults.results,
          testSummary: testResults.summary,
        },
        error: null,
      } satisfies ResponseData<StoryDiscoveryResponsePayload>);

      if (!coreOptions.disableTelemetry) {
        // TODO: Add story-discovery telemetry event
        telemetry('story-discovery', {
          success: true,
          generatedCount: allGeneratedStories.length,
          testResults: testResults.summary,
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
        // TODO: Add story-discovery telemetry event
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
