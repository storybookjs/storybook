import type { StoryIndex } from 'storybook/internal/types';

import type { FindByComponentOutput } from './definition.ts';

/** Default import-graph distance ceiling (mirrors addon-mcp). */
export const DEFAULT_MAX_DISTANCE = 3;

export type ComponentStoryDepth = {
  storyId: string;
  depth: number;
};

export type ResolveComponentMatchesResult = {
  /** Echo of the caller's input path (normalized by the resolver). */
  componentPath: string;
  matches: ComponentStoryDepth[];
  /** `true` when no file exists at the resolved path. */
  pathNotFound?: boolean;
};

/**
 * Resolves component paths to reverse-graph story hits.
 *
 * Injected so unit tests and common-preset wiring can supply module-graph walks (or fixtures)
 * without coupling this helper to the live graph service.
 */
export type ResolveComponentMatches = (
  componentPaths: string[]
) => ResolveComponentMatchesResult[] | Promise<ResolveComponentMatchesResult[]>;

export type FindStoriesByComponentParams = {
  componentPaths: string[];
  /** Maximum import-graph distance to include. Defaults to {@link DEFAULT_MAX_DISTANCE}. */
  maxDistance?: number;
  index: StoryIndex;
};

export type ClippedByMaxDistance = {
  count: number;
  distances: number[];
};

function applyMaxDistance(
  depths: ComponentStoryDepth[],
  maxDistance: number
): { kept: ComponentStoryDepth[]; clipped?: ClippedByMaxDistance } {
  const kept: ComponentStoryDepth[] = [];
  const clippedDistances = new Set<number>();
  let clippedCount = 0;

  for (const d of depths) {
    if (d.depth <= maxDistance) {
      kept.push(d);
    } else {
      clippedCount++;
      clippedDistances.add(d.depth);
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
 * Shapes reverse-graph matches into the `stories.findByComponent` output.
 *
 * Graph walking is injected via `resolveMatches` — this helper only applies `maxDistance`
 * clipping, enriches from the story index, and preserves `pathNotFound`.
 */
export async function findStoriesByComponent(
  { componentPaths, maxDistance = DEFAULT_MAX_DISTANCE, index }: FindStoriesByComponentParams,
  resolveMatches: ResolveComponentMatches
): Promise<FindByComponentOutput> {
  const resolved = await resolveMatches(componentPaths);

  const results: FindByComponentOutput['results'] = resolved.map((entry) => {
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

  return { results };
}
