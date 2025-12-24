import type { Channel } from 'storybook/internal/channels';
import type {
  GeneratedStoryInfo,
  RequestData,
  ResponseData,
  RunStoryTestsRequestPayload,
  RunStoryTestsResponsePayload,
  StoryDiscoveryProgressPayload,
  StoryDiscoveryRequestPayload,
  StoryDiscoveryResponsePayload,
} from 'storybook/internal/core-events';
import {
  RUN_STORY_TESTS_REQUEST,
  RUN_STORY_TESTS_RESPONSE,
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

      const testRunResult = await new Promise<RunStoryTestsResponsePayload>((resolve, reject) => {
        const requestId = `story-discovery-${Date.now()}`;

        const handleResponse = (response: ResponseData<RunStoryTestsResponsePayload>) => {
          if (response.id === requestId) {
            channel.off(RUN_STORY_TESTS_RESPONSE, handleResponse);
            if (response.success) {
              resolve(response.payload);
            } else {
              reject(new Error(response.error || 'Failed to run story tests'));
            }
          }
        };

        channel.on(RUN_STORY_TESTS_RESPONSE, handleResponse);

        // Emit the test run request
        channel.emit(RUN_STORY_TESTS_REQUEST, {
          id: requestId,
          payload: {
            storyIds,
          },
        } satisfies RequestData<RunStoryTestsRequestPayload>);
      });

      if (!testRunResult.success) {
        throw new Error(testRunResult.error || 'Failed to run story tests');
      }

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
