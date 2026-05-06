import type { Channel } from 'storybook/internal/channels';
import { GHOST_STORIES_REQUEST, GHOST_STORIES_RESPONSE } from 'storybook/internal/core-events';
import { getLastEvents, getStorybookMetadata, telemetry } from 'storybook/internal/telemetry';
import type { Options } from 'storybook/internal/types';

import { getComponentCandidates } from '../utils/ghost-stories/get-candidates.ts';
import { runStoryTests } from '../utils/ghost-stories/run-story-tests.ts';
import { waitForIdleVitest } from '../utils/wait-for-idle-vitest.ts';
import { getAiSetupRunId } from '../../shared/utils/ai-checklist-flags.ts';

class SkipGhostStoriesTelemetry extends Error {}

export function initGhostStoriesChannel(channel: Channel, options: Options) {
  /** Listens for events to discover and test stories */
  channel.on(GHOST_STORIES_REQUEST, async () => {
    const stats: {
      globMatchCount?: number;
      candidateAnalysisDuration?: number;
      totalRunDuration?: number;
      analyzedCount?: number;
      avgComplexity?: number;
      aiSetupRunId?: string;

      candidateCount?: number;
      testRunDuration?: number;
    } = {};

    try {
      await telemetry('ghost-stories', async () => {
        try {
          const ghostRunStart = Date.now();
          const lastEvents = await getLastEvents();
          const lastInit = lastEvents?.init;
          const lastAISetup = lastEvents?.['ai-setup'];
          const lastSetupStoryScoringRun = lastEvents?.['ai-setup-final-scoring'];
          const lastGhostStoriesRun = lastEvents?.['ghost-stories'];

          // We only want to run ghost stories immediately after init or ai setup.
          const lastRelevantEvent = lastAISetup ?? lastInit;
          if (!lastRelevantEvent) {
            throw new SkipGhostStoriesTelemetry();
          }

          // Already ran once for this project — never run again, unless we need fresh
          // data for a new instance of `ai setup`.
          if (
            lastGhostStoriesRun &&
            (!lastSetupStoryScoringRun ||
              lastSetupStoryScoringRun.body.payload.runId === lastAISetup.body.payload.runId)
          ) {
            throw new SkipGhostStoriesTelemetry();
          }

          // No session-ID match: `storybook ai setup` runs as a separate CLI
          // process, so its sessionId never matches the dev server's. The
          // `lastGhostStoriesRun` guard above is enough to enforce once-per-project.

          const metadata = await getStorybookMetadata(options.configDir);
          const isReactStorybook = metadata?.renderer?.includes('@storybook/react');
          const hasVitestAddon =
            !!metadata?.addons &&
            Object.keys(metadata.addons).some((addonKey) =>
              addonKey.includes('@storybook/addon-vitest')
            );

          // For now this is gated by React + Vitest
          if (!isReactStorybook || !hasVitestAddon) {
            throw new SkipGhostStoriesTelemetry();
          }

          // Wait for any running tests to finish before launching scoring, so we don't
          // disturb end user activities.
          const isIdle = await waitForIdleVitest();
          if (!isIdle) {
            return;
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
              runError: candidatesResult.error,
            };
          }

          if (candidatesResult.candidates.length === 0) {
            stats.totalRunDuration = Date.now() - ghostRunStart;
            return {
              stats,
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
              runError: testRunResult.runError,
            };
          }

          const aiSetupRunId = await getAiSetupRunId(options.configDir);
          if (aiSetupRunId) {
            stats.aiSetupRunId = aiSetupRunId;
          }

          return {
            stats,
            results: testRunResult.summary,
          };
        } catch (error) {
          if (error instanceof SkipGhostStoriesTelemetry) {
            throw error;
          }

          return {
            stats,
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
