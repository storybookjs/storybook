import { existsSync } from 'node:fs';

import type { StoryIndex } from 'storybook/internal/types';

import { isAbsolute, join } from 'pathe';

import type { ModuleGraphService } from '../module-graph/definition.ts';
import type { ResolveComponentMatchesResult } from './find-by-component.ts';

export type ResolveComponentMatchesOptions = {
  componentPaths: string[];
  index: StoryIndex;
  moduleGraph: ModuleGraphService;
};

export async function resolveComponentMatches({
  componentPaths,
  index,
  moduleGraph,
}: ResolveComponentMatchesOptions): Promise<ResolveComponentMatchesResult[]> {
  let storiesForFiles: Array<Array<{ storyFile: string; depth: number }>>;
  try {
    storiesForFiles = await moduleGraph.queries.storiesForFiles.loaded({
      files: componentPaths,
    });
  } catch {
    return componentPaths.map((componentPath) => ({ componentPath, matches: [] }));
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
    const absolute = isAbsolute(componentPath) ? componentPath : join(process.cwd(), componentPath);
    if (!existsSync(absolute)) {
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
