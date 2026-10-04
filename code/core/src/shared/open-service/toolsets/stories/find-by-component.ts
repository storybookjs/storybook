import type { StoryIndex } from 'storybook/internal/types';

import type { FindByComponentOutput } from './definition.ts';
import {
  resolveComponentStories,
  type ComponentStoryDepth,
  type ModuleGraphAccess,
} from './resolve-component-stories.ts';

/** Default import-graph distance ceiling. */
export const DEFAULT_MAX_DISTANCE = 3;

export type ClippedByMaxDistance = {
  count: number;
  distances: number[];
};

export type FindStoriesByComponentParams = {
  componentPaths: string[];
  /** Maximum import-graph distance to include. Defaults to {@link DEFAULT_MAX_DISTANCE}. */
  maxDistance?: number;
  index: StoryIndex;
  moduleGraph: ModuleGraphAccess | undefined;
};

/**
 * Either the per-path matches, or why the module graph could not answer.
 *
 * The unavailable case is distinct on purpose: reporting "no stories" when the graph is still
 * building or the builder has no change detection would tell an agent that every component is
 * unused.
 */
export type FindStoriesByComponentResult =
  | { available: false; reason: string }
  | { available: true; results: FindByComponentOutput['results'] };

function applyMaxDistance(
  depths: ComponentStoryDepth[],
  maxDistance: number
): { kept: ComponentStoryDepth[]; clipped?: ClippedByMaxDistance } {
  const kept: ComponentStoryDepth[] = [];
  const clippedDistances = new Set<number>();
  let clippedCount = 0;

  for (const depth of depths) {
    if (depth.depth <= maxDistance) {
      kept.push(depth);
    } else {
      clippedCount++;
      clippedDistances.add(depth.depth);
    }
  }

  const clipped =
    clippedCount > 0
      ? {
          count: clippedCount,
          distances: [...clippedDistances].sort((a, b) => a - b),
        }
      : undefined;

  return { kept, clipped };
}

/**
 * Resolves reverse-graph matches into the `stories.findByComponent` output, applying
 * `maxDistance` clipping and story-index enrichment.
 */
export async function findStoriesByComponent({
  componentPaths,
  maxDistance = DEFAULT_MAX_DISTANCE,
  index,
  moduleGraph,
}: FindStoriesByComponentParams): Promise<FindStoriesByComponentResult> {
  const lookup = await resolveComponentStories(
    { componentPaths },
    { getStoryIndex: async () => index, moduleGraph }
  );

  if (!lookup.available) {
    return {
      available: false,
      reason: lookup.reason ?? "Storybook's story module graph is unavailable.",
    };
  }

  const results = (lookup.results ?? []).map((entry) => {
    if (entry.pathNotFound) {
      return { componentPath: entry.componentPath, matches: [], pathNotFound: true };
    }

    const { kept, clipped } = applyMaxDistance(entry.matches, maxDistance);
    const matches: FindByComponentOutput['results'][number]['matches'] = [];

    for (const { storyId, depth } of kept) {
      const indexEntry = index.entries[storyId];
      if (!indexEntry || indexEntry.type !== 'story') {
        continue;
      }
      matches.push({
        storyId: indexEntry.id,
        title: indexEntry.title,
        name: indexEntry.name,
        importPath: indexEntry.importPath,
        distance: depth,
      });
    }

    return clipped
      ? { componentPath: entry.componentPath, matches, clipped }
      : { componentPath: entry.componentPath, matches };
  });

  return { available: true, results };
}
