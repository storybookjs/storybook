import type { Channel } from 'storybook/internal/channels';
import { GHOST_STORIES_REQUEST, GHOST_STORIES_RESPONSE } from 'storybook/internal/core-events';
import {
  getLastEvents,
  getSessionId,
  getStorybookMetadata,
  telemetry,
} from 'storybook/internal/telemetry';
import type { CoreConfig, Options } from 'storybook/internal/types';

import { getComponentCandidates } from '../utils/ghost-stories/get-candidates';
import { runStoryTests } from '../utils/ghost-stories/run-story-tests';

export function initGhostStoriesChannel(
  channel: Channel,
  options: Options,
  coreOptions: CoreConfig
) {
  if (coreOptions.disableTelemetry) {
    return channel;
  }

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

    try {
      const ghostRunStart = Date.now();
      const lastEvents = await getLastEvents();
      const sessionId = await getSessionId();
      const lastInit = lastEvents?.init;
      const lastGhostStoriesRun = lastEvents['ghost-stories'];
      if (
        lastGhostStoriesRun ||
        (lastInit?.body?.sessionId && lastInit?.body?.sessionId !== sessionId)
      ) {
        return;
      }

      const metadata = await getStorybookMetadata(options.configDir);
      const isReactStorybook = metadata?.renderer?.includes('@storybook/react');
      const hasVitestAddon =
        !!metadata?.addons &&
        Object.keys(metadata.addons).some((addonKey) =>
          addonKey.includes('@storybook/addon-vitest')
        );

      // For now this is gated by React + Vitest
      if (!isReactStorybook || !hasVitestAddon) {
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
        telemetry('ghost-stories', {
          success: false,
          error: candidatesResult.error,
          stats,
        });
        return;
      }

      if (candidatesResult.candidates.length === 0) {
        stats.totalRunDuration = Date.now() - ghostRunStart;
        telemetry('ghost-stories', {
          success: false,
          error: 'No candidates found',
          stats,
        });
        return;
      }

      // Phase 2: Run tests on those candidates Vitest. The components will be transformed directly to tests
      // If they pass, it means that creating a story file for them would succeed.
      const testRunResult = await runStoryTests(candidatesResult.candidates);
      stats.totalRunDuration = Date.now() - ghostRunStart;
      stats.testRunDuration = testRunResult.duration;
      telemetry('ghost-stories', {
        ...(testRunResult.error !== undefined ? { error: testRunResult.error } : {}),
        success: testRunResult.success,
        stats,
        results: testRunResult.summary,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      telemetry('ghost-stories', {
        success: false,
        error: errorMessage,
        stats,
      });
    } finally {
      // we don't currently do anything with this, but will be useful in the future
      channel.emit(GHOST_STORIES_RESPONSE);
    }
  });

  return channel;
}
