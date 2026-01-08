import type { Channel } from 'storybook/internal/channels';
import { cache } from 'storybook/internal/common';
import { GHOST_STORIES_REQUEST, GHOST_STORIES_RESPONSE } from 'storybook/internal/core-events';
import { logger } from 'storybook/internal/node-logger';
import { getStorybookMetadata, telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig, Options } from 'storybook/internal/types';

import { getComponentCandidates } from '../utils/ghost-stories/get-candidates';
import { runStoryTests } from '../utils/ghost-stories/run-story-tests';

const GHOST_STORIES_CACHE_KEY = 'experimental/ghost-stories/has-run';

export function initGhostStoriesChannel(
  channel: Channel,
  options: Options,
  coreOptions: CoreConfig
) {
  if (coreOptions.disableTelemetry) {
    logger.debug('Skipping discovery run - telemetry disabled');
    return;
  }

  /** Listens for events to discover and test stories */
  channel.on(GHOST_STORIES_REQUEST, async () => {
    let matchCount = 0;
    try {
      // only execute discovery if it's a storybook init run
      // TODO: uncomment this later, it's commented out for debugging purposes
      // const lastEvents = await getLastEvents();
      // const lastPreviewFirstLoad = lastEvents['preview-first-load'];
      // if (lastPreviewFirstLoad) {
      //   logger.debug('Skipping discovery run', { lastEvents });
      //   return;
      // }

      const alreadyRan = await cache.get(GHOST_STORIES_CACHE_KEY);
      if (alreadyRan) {
        logger.debug('Skipping discovery run - already ran');
        return;
      }

      const metadata = await getStorybookMetadata(options.configDir);
      const isReactStorybook = metadata?.renderer === '@storybook/react';
      const hasVitestAddon = metadata?.addons && '@storybook/addon-vitest' in metadata.addons;

      // For now this is gated by React + Vitest
      if (!isReactStorybook || !hasVitestAddon) {
        logger.debug(
          'Skipping discovery run - not react vitest: ' + JSON.stringify(metadata, null, 2)
        );
        return;
      }

      // Mark as ran up-front so we only ever attempt this once
      await cache.set(GHOST_STORIES_CACHE_KEY, { timestamp: Date.now() });

      // First, generate stories from components based on a glob pattern
      logger.debug('Generating stories...');
      const analysisStart = Date.now();
      const candidatesResult = await getComponentCandidates();
      const analysisDuration = Date.now() - analysisStart;
      logger.debug(`Component analysis took ${analysisDuration}ms`);
      matchCount = candidatesResult.matchCount;
      logger.debug('Candidates found: ' + JSON.stringify(candidatesResult, null, 2));
      if (candidatesResult.error) {
        telemetry('ghost-stories', {
          success: false,
          error: candidatesResult.error,
          matchCount,
          analysisDuration,
        });
        return;
      }

      if (candidatesResult.candidates.length === 0) {
        logger.debug('No candidates found');
        telemetry('ghost-stories', {
          success: false,
          error: 'No candidates found',
          matchCount,
          analysisDuration,
        });
        return;
      }

      // Phase 2: Run tests on generated stories using Vitest
      const testRunResult = await runStoryTests(candidatesResult.candidates);
      logger.debug('Test results: ' + JSON.stringify(testRunResult, null, 2));

      telemetry('ghost-stories', {
        success: testRunResult.success,
        error: testRunResult.error,
        generatedCount: candidatesResult.candidates.length,
        testDuration: testRunResult.duration,
        analysisDuration,
        testResults: testRunResult.testSummary,
        matchCount: candidatesResult.matchCount,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.debug('Error generating stories: ' + errorMessage);
      telemetry('ghost-stories', {
        success: false,
        error: errorMessage,
        matchCount,
      });
    } finally {
      // we don't currently do anything with this, but will be useful in the future
      channel.emit(GHOST_STORIES_RESPONSE);
    }
  });

  return channel;
}
