import type { StoryDocsById } from './types.ts';

export function selectManifestStories(
  stories: StoryDocsById,
  manifestStoryIds: ReadonlySet<string>
) {
  return Object.fromEntries(Object.entries(stories).filter(([id]) => manifestStoryIds.has(id)));
}
