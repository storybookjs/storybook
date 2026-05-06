import type { ParserRegistry } from '../parser-registry/index.ts';
import type { ParseResolveCache } from './ParseResolveCache.ts';
import type { ReverseIndexImpl } from './ReverseIndex.ts';

const MAX_BFS_DEPTH = 50;

export interface WalkFromStoryArgs {
  storyRoot: string;
  registry: ParserRegistry;
  cache: ParseResolveCache;
  reverseIndex: ReverseIndexImpl;
  /** Called once per visited file with its resolved outgoing dependencies. */
  recordEdges: (file: string, deps: Set<string>) => void;
}

/**
 * BFS forward-walk from `storyRoot`, parsing + resolving each file once via the shared
 * cache and recording (dep, story, depth) tuples on `reverseIndex`. Stops at non-walkable
 * files (no parser registered).
 */
export async function walkFromStory({
  storyRoot,
  registry,
  cache,
  reverseIndex,
  recordEdges,
}: WalkFromStoryArgs): Promise<void> {
  reverseIndex.record(storyRoot, storyRoot, 0);

  const visited = new Map<string, number>();
  visited.set(storyRoot, 0);
  const queue: Array<{ file: string; depth: number }> = [{ file: storyRoot, depth: 0 }];
  let head = 0;

  while (head < queue.length) {
    const { file, depth } = queue[head++];

    if (registry.parserFor(file) === undefined) {
      continue;
    }

    const resolvedDeps = await cache.resolveOnce(file);
    recordEdges(file, resolvedDeps);

    const nextDepth = depth + 1;
    for (const normalised of resolvedDeps) {
      if (nextDepth > MAX_BFS_DEPTH) {
        // Skip — prevents unbounded walks in pathological dep trees
        continue;
      }
      const previousDepth = visited.get(normalised);
      if (previousDepth !== undefined && previousDepth <= nextDepth) {
        continue;
      }
      visited.set(normalised, nextDepth);
      reverseIndex.record(normalised, storyRoot, nextDepth);
      queue.push({ file: normalised, depth: nextDepth });
    }
  }
}
