import type { Channel } from '@storybook/core/internal/channels';
import {
  GHOST_STORIES_REQUEST,
  GHOST_STORIES_RESPONSE,
} from '@storybook/core/internal/core-events';
import { getLastEvents, telemetry } from '@storybook/core/internal/telemetry';

import { getComponentCandidates } from '@storybook/core/internal/deep/story-index/ghost-stories/get-candidates';
import { runStoryTests } from '@storybook/core/internal/deep/story-index/ghost-stories/run-story-tests';
import { waitForIdleVitest } from './wait-for-idle-vitest.ts';
import { getAiSetupRunId } from '@storybook/core/internal/deep/utils/ai-checklist-flags';

/** What the AI-setup scoring handlers read from their Storybook. */
export interface AiScoringOptions {
  /** Absolute config directory, which scopes the AI-setup cache flags. */
  configDir: string;
  /** Scoring runs for React only; read lazily, after the cheaper skip checks. */
  isReactStorybook: () => boolean;
}

class SkipGhostStoriesTelemetry extends Error {}

export function initGhostStoriesChannel(channel: Channel, options: AiScoringOptions): Channel {
  /** Listens for events to discover and test stories */
  channel.on(GHOST_STORIES_REQUEST, async () => {
    const stats: {
      globMatchCount?: number;
      candidateAnalysisDuration?: number;
      totalRunDuration?: number;
      analyzedCount?: number;
      avgComplexity?: number;

      candidateCount?: number;
      testRunDuration?: number;
    } = {};

    // Initialize contextual data; if ghost stories are triggered to assess the
    // quality of a `skills setup` workflow, inject the runId for that setup session.
    const aiSetupRunId = await getAiSetupRunId(options.configDir);

    try {
      await telemetry('ghost-stories', async () => {
        try {
          const ghostRunStart = Date.now();
          const lastEvents = await getLastEvents();
          const lastInit = lastEvents?.init;
          const lastAISetup = lastEvents?.['ai-setup'];
          const lastSetupStoryScoringRun = lastEvents?.['ai-setup-final-scoring'];
          const lastGhostStoriesRun = lastEvents?.['ghost-stories'];

          // We only want to run ghost stories immediately after init or `skills setup`.
          const lastRelevantEvent = lastAISetup ?? lastInit;
          if (!lastRelevantEvent) {
            throw new SkipGhostStoriesTelemetry();
          }

          // Already ran once for this project — re-run it only when we need fresh
          // data for a new instance of `skills setup`.
          if (
            lastGhostStoriesRun &&
            lastSetupStoryScoringRun.body.payload.runId === lastAISetup.body.payload.runId
          ) {
            throw new SkipGhostStoriesTelemetry();
          }

          // For now this is gated by React; addon-vitest is present, as it registers this handler.
          if (!options.isReactStorybook()) {
            throw new SkipGhostStoriesTelemetry();
          }

          // Wait for any running tests to finish before launching scoring, so we don't
          // disturb end user activities.
          const isIdle = await waitForIdleVitest();
          if (!isIdle) {
            return {
              stats,
              aiSetupRunId,
              runError: "Vitest busy, couldn't run ghost stories",
            };
          }

          // Phase 1: find candidates from components
          const candidateAnalysisStart = Date.now();
          const candidatesResult = await getComponentCandidates();
          stats.candidateAnalysisDuration = Date.now() - candidateAnalysisStart;
          stats.globMatchCount = candidatesResult.globMatchCount;
          stats.analyzedCount = candidatesResult.analyzedCount ?? 0;
          stats.avgComplexity = candidatesResult.avgComplexity ?? 0;
          stats.candidateCount = candidatesResult.candidates.length;

          if (candidatesResult.error) {
            stats.totalRunDuration = Date.now() - ghostRunStart;
            return {
              stats,
              aiSetupRunId,
              runError: candidatesResult.error,
            };
          }

          if (candidatesResult.candidates.length === 0) {
            stats.totalRunDuration = Date.now() - ghostRunStart;
            return {
              stats,
              aiSetupRunId,
              runError: 'No candidates found',
            };
          }

          // Phase 2: Run tests on those candidates Vitest. The components will be transformed directly to tests
          // If they pass, it means that creating a story file for them would succeed.
          const testRunResult = await runStoryTests(candidatesResult.candidates, {
            ghostRun: true,
          });
          stats.totalRunDuration = Date.now() - ghostRunStart;
          stats.testRunDuration = testRunResult.duration;
          if (testRunResult.runError) {
            return {
              stats,
              aiSetupRunId,
              runError: testRunResult.runError,
            };
          }

          return {
            stats,
            aiSetupRunId,
            results: testRunResult.summary,
          };
        } catch (error) {
          if (error instanceof SkipGhostStoriesTelemetry) {
            throw error;
          }

          return {
            stats,
            aiSetupRunId,
            runError: 'Unknown error during ghost run',
          };
        }
      });
    } catch (error) {
      if (!(error instanceof SkipGhostStoriesTelemetry)) {
        throw error;
      }
    } finally {
      // we don't currently do anything with this, but will be useful in the future
      channel.emit(GHOST_STORIES_RESPONSE);
    }
  });

  return channel;
}
