import { createFileSystemCache, resolvePathInStorybookCache } from 'storybook/internal/common';
import type { StoryTestResult, StoryTestResultHistory } from 'storybook/internal/core-server';

const CACHE_KEY = 'agent-self-healing-story-history';

const historyCache = createFileSystemCache({
  basePath: resolvePathInStorybookCache('agent-self-healing'),
  ns: 'storybook',
});

export async function readStoryHistory(): Promise<StoryTestResultHistory> {
  return (await historyCache.get<StoryTestResultHistory>(CACHE_KEY)) ?? {};
}

/**
 * Merge the current run's results into the persisted history (keeping the most
 * recent result per storyId) and return the full set of stories ever observed.
 * The history lives only on disk in the Storybook cache — its entries (which
 * include storyIds) are never sent in telemetry.
 */
export async function mergeAndWriteStoryHistory(
  results: StoryTestResult[]
): Promise<StoryTestResult[]> {
  const history = await readStoryHistory();
  const now = Date.now();

  for (const result of results) {
    const existing = history[result.storyId];
    if (!existing || existing.timestamp <= now) {
      history[result.storyId] = { ...result, timestamp: now };
    }
  }

  await historyCache.set(CACHE_KEY, history);

  return Object.values(history).map(({ timestamp, ...rest }) => rest);
}
