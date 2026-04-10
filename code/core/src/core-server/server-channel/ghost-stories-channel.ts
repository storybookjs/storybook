import type { Channel } from 'storybook/internal/channels';
import { GHOST_STORIES_REQUEST, GHOST_STORIES_RESPONSE } from 'storybook/internal/core-events';
import { getLastEvents, getStorybookMetadata, telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig, Options } from 'storybook/internal/types';

import { isStoryCreatedByAISetup } from '../../telemetry/ai-prepare-evidence.ts';
import { fullTestProviderStore } from '../stores/test-provider.ts';
import { getComponentCandidates } from '../utils/ghost-stories/get-candidates.ts';
import { runGhostStories } from '../utils/ghost-stories/run-story-tests.ts';
import type { StoryIndexGenerator } from '../utils/StoryIndexGenerator.ts';

/**
 * Wait for the test provider to be idle (no tests running).
 * Returns true if idle, false if timed out.
 */
async function waitForTestsIdle(
  maxWaitMs = 30 * 60 * 1000,
  pollIntervalMs = 60 * 1000
): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    try {
      const state = fullTestProviderStore.getFullState();
      const isRunning = Object.values(state).some((s) => s === 'test-provider-state:running');
      if (!isRunning) {
        return true;
      }
    } catch {
      // Store not initialized yet — treat as idle
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return false;
}

export function initGhostStoriesChannel(
  channel: Channel,
  options: Options,
  coreOptions: CoreConfig,
  getStoryIndexGeneratorPromise?: () => Promise<StoryIndexGenerator> | undefined
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
      const lastInit = lastEvents?.init;
      if (!lastEvents || !lastInit) {
        return;
      }

      const lastGhostStoriesRun = lastEvents['ghost-stories'];
      if (lastGhostStoriesRun) {
        return; // Already ran once for this project — never run again
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

      // Wait for any running tests to finish before launching scoring
      const isIdle = await waitForTestsIdle();
      if (!isIdle) {
        telemetry('ghost-stories', {
          stats,
          runError: 'Timed out waiting for tests to finish',
        });
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
          stats,
          runError: candidatesResult.error,
        });
        return;
      }

      if (candidatesResult.candidates.length === 0) {
        stats.totalRunDuration = Date.now() - ghostRunStart;
        telemetry('ghost-stories', {
          stats,
          runError: 'No candidates found',
        });
        return;
      }

      // Phase 2: Run tests on those candidates Vitest. The components will be transformed directly to tests
      // If they pass, it means that creating a story file for them would succeed.
      const testRunResult = await runGhostStories(candidatesResult.candidates);
      stats.totalRunDuration = Date.now() - ghostRunStart;
      stats.testRunDuration = testRunResult.duration;
      if (testRunResult.runError) {
        telemetry('ghost-stories', {
          stats,
          runError: testRunResult.runError,
        });
        return;
      }

      telemetry('ghost-stories', {
        stats,
        results: testRunResult.summary,
      });

      // Phase 3: Score AI-written stories (if any)
      const generatorPromise = getStoryIndexGeneratorPromise?.();
      if (generatorPromise) {
        try {
          const generator = await generatorPromise;
          const indexAndStats = await generator.getIndexAndStats();
          if (indexAndStats) {
            const aiStoryFiles = new Set<string>();
            for (const entry of Object.values(indexAndStats.storyIndex.entries)) {
              if (entry.type === 'story' && isStoryCreatedByAISetup(entry)) {
                aiStoryFiles.add(entry.importPath);
              }
            }

            if (aiStoryFiles.size > 0) {
              const aiTestRunResult = await runGhostStories([...aiStoryFiles]);
              telemetry('ai-prepare-story-scoring', {
                stats: {
                  fileCount: aiStoryFiles.size,
                  testRunDuration: aiTestRunResult.duration,
                },
                results: aiTestRunResult.summary,
                ...(aiTestRunResult.runError ? { runError: aiTestRunResult.runError } : {}),
              });
            }
          }
        } catch {
          telemetry('ai-prepare-story-scoring', {
            runError: 'Unknown error during AI story scoring',
          });
        }
      }
    } catch {
      telemetry('ghost-stories', {
        stats,
        runError: 'Unknown error during ghost run',
      });
    } finally {
      // we don't currently do anything with this, but will be useful in the future
      channel.emit(GHOST_STORIES_RESPONSE);
    }
  });

  return channel;
}
