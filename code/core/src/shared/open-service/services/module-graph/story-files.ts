import { join, normalize } from 'pathe';

import type { StoryIndex } from '../../../../types/modules/indexer.ts';

/**
 * Maps each story index to its absolute-story-file -> story-id sets, keyed by the index object
 * so repeat calls within a scan/build reuse the result. The story index is referentially stable
 * for a given generation, so identity-keying is safe; the `workingDir` field guards against the
 * (test-only) case of the same index resolved against a different working directory.
 */
const cache = new WeakMap<
  StoryIndex,
  { workingDir: string; storyIdsByFile: Map<string, Set<string>> }
>();

/**
 * Builds (or returns a cached) map from absolute story-file path to the set of story ids declared
 * in that file. Virtual entries are skipped. Shared by the dependency-graph tracker (to derive its
 * story-root set) and the status publisher (to map affected files back to story ids).
 */
export function getStoryIdsByAbsolutePath(
  storyIndex: StoryIndex,
  workingDir: string
): Map<string, Set<string>> {
  const cached = cache.get(storyIndex);
  if (cached && cached.workingDir === workingDir) {
    return cached.storyIdsByFile;
  }

  const storyIdsByFile = new Map<string, Set<string>>();
  Object.values(storyIndex.entries).forEach((entry) => {
    if (entry.type === 'story' && !entry.importPath.startsWith('virtual:')) {
      const filePath = normalize(join(workingDir, entry.importPath));
      const storyIds = storyIdsByFile.get(filePath) ?? new Set<string>();
      storyIds.add(entry.id);
      storyIdsByFile.set(filePath, storyIds);
    }
  });

  cache.set(storyIndex, { workingDir, storyIdsByFile });
  return storyIdsByFile;
}
