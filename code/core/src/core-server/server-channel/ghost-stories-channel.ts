import type { Channel } from 'storybook/internal/channels';
import { GHOST_STORIES_REQUEST, GHOST_STORIES_RESPONSE } from 'storybook/internal/core-events';
import { logger } from 'storybook/internal/node-logger';
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
    logger.debug('Skipping ghost run - telemetry disabled');
    return channel;
  }

  /** Listens for events to discover and test stories */
  channel.on(GHOST_STORIES_REQUEST, async () => {
    const stats: {
      globMatchCount?: number;
      candidateAnalysisDuration?: number;
      ghostRunDuration?: number;
      analyzedCount?: number;
      avgComplexity?: number;
      candidateCount?: number;
      testRunDuration?: number;
    } = {};

    try {
      const ghostRunStart = Date.now();
      // only execute ghost if it's a storybook init run
      const lastEvents = await getLastEvents();
      const sessionId = await getSessionId();
      const lastInit = lastEvents?.init;
      const lastGhostStoriesRun = lastEvents['ghost-stories'];
      if (lastGhostStoriesRun || lastInit.body.sessionId !== sessionId) {
        logger.debug('Would normally skip ghost run');
        // TODO: uncomment this later, it's commented out for debugging purposes DO NOT MERGE WITH THIS
        // return;
      }

      const metadata = await getStorybookMetadata(options.configDir);
      const isReactStorybook = metadata?.renderer === '@storybook/react';
      const hasVitestAddon = metadata?.addons && '@storybook/addon-vitest' in metadata.addons;

      // For now this is gated by React + Vitest
      if (!isReactStorybook || !hasVitestAddon) {
        logger.debug('Skipping ghost run - not react vitest: ' + JSON.stringify(metadata, null, 2));
        return;
      }

      // First, find candidates from components based on a glob pattern
      logger.debug('Finding candidates...');
      const candidateAnalysisStart = Date.now();
      const candidatesResult = await getComponentCandidates();
      stats.candidateAnalysisDuration = Date.now() - candidateAnalysisStart;
      logger.debug(`Component analysis took ${stats.candidateAnalysisDuration}ms`);
      stats.globMatchCount = candidatesResult.globMatchCount;
      stats.analyzedCount = candidatesResult.analyzedCount ?? 0;
      stats.avgComplexity = candidatesResult.avgComplexity ?? 0;
      stats.candidateCount = candidatesResult.candidates.length;

      logger.debug('Candidates found: ' + JSON.stringify(candidatesResult, null, 2));
      if (candidatesResult.error) {
        stats.ghostRunDuration = Date.now() - ghostRunStart;
        telemetry('ghost-stories', {
          success: false,
          error: candidatesResult.error,
          stats,
        });
        return;
      }

      if (candidatesResult.candidates.length === 0) {
        stats.ghostRunDuration = Date.now() - ghostRunStart;
        logger.debug('No candidates found');
        telemetry('ghost-stories', {
          success: false,
          error: 'No candidates found',
          stats,
        });
        return;
      }

      // Phase 2: Run tests on generated stories using Vitest
      const testRunResult = await runStoryTests(candidatesResult.candidates);
      logger.debug('Test results: ' + JSON.stringify(testRunResult, null, 2));
      stats.ghostRunDuration = Date.now() - ghostRunStart;
      stats.testRunDuration = testRunResult.duration;
      telemetry('ghost-stories', {
        ...(testRunResult.error !== undefined ? { error: testRunResult.error } : {}),
        success: testRunResult.success,
        stats,
        results: testRunResult.summary,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.debug('Error generating stories: ' + errorMessage);
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
