import { existsSync } from 'node:fs';

import type { StoryIndex } from 'storybook/internal/types';

import { isAbsolute, join } from 'pathe';

import type { ModuleGraphService } from '../../services/module-graph/definition.ts';
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

export type FindStoriesByComponentParams = {
  componentPaths: string[];
  /** Maximum import-graph distance to include. Defaults to {@link DEFAULT_MAX_DISTANCE}. */
  maxDistance?: number;
  index: StoryIndex;
  moduleGraph: ModuleGraphService;
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

export async function resolveComponentMatches({
  componentPaths,
  index,
  moduleGraph,
}: {
  componentPaths: string[];
  index: StoryIndex;
  moduleGraph: ModuleGraphService;
}): Promise<ResolveComponentMatchesResult[]> {
  // Exists-check first so missing paths skip the graph query cost when every path is missing.
  // Mixed present/missing still queries once for the batch (module-graph API is bulk).
  const absolutePaths = componentPaths.map((componentPath) =>
    isAbsolute(componentPath) ? componentPath : join(process.cwd(), componentPath)
  );
  const missing = absolutePaths.map((absolute) => !existsSync(absolute));
  if (missing.every(Boolean)) {
    return componentPaths.map((componentPath) => ({
      componentPath,
      matches: [],
      pathNotFound: true,
    }));
  }

  let storiesForFiles: Array<Array<{ storyFile: string; depth: number }>>;
  try {
    storiesForFiles = await moduleGraph.queries.storiesForFiles.loaded({
      files: componentPaths,
    });
  } catch {
    return componentPaths.map((componentPath, position) =>
      missing[position]
        ? { componentPath, matches: [], pathNotFound: true }
        : { componentPath, matches: [] }
    );
  }

  const storyIdsByFile = new Map<string, string[]>();
  for (const entry of Object.values(index.entries)) {
    if (entry.type !== 'story' || entry.importPath.startsWith('virtual:')) {
      continue;
    }
    const key = entry.importPath.startsWith('./') ? entry.importPath : `./${entry.importPath}`;
    const ids = storyIdsByFile.get(key) ?? [];
    ids.push(entry.id);
    storyIdsByFile.set(key, ids);
  }

  return componentPaths.map((componentPath, position) => {
    if (missing[position]) {
      return { componentPath, matches: [], pathNotFound: true };
    }

    const byStoryId = new Map<string, number>();
    for (const { storyFile, depth } of storiesForFiles[position] ?? []) {
      for (const storyId of storyIdsByFile.get(storyFile) ?? []) {
        const existing = byStoryId.get(storyId);
        if (existing === undefined || depth < existing) {
          byStoryId.set(storyId, depth);
        }
      }
    }

    return {
      componentPath,
      matches: [...byStoryId.entries()]
        .map(([storyId, depth]) => ({ storyId, depth }))
        .sort((a, b) =>
          a.depth !== b.depth ? a.depth - b.depth : a.storyId.localeCompare(b.storyId)
        ),
    };
  });
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
}: FindStoriesByComponentParams): Promise<FindByComponentOutput> {
  const resolved = await resolveComponentMatches({ componentPaths, index, moduleGraph });

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
