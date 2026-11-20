import type { StoryDocsById } from './types.ts';

// Returns `undefined` rather than an empty record, so dev and a build both leave `stories` out.
export function selectManifestStories(
  stories: StoryDocsById,
  manifestStoryIds: ReadonlySet<string>
): StoryDocsById | undefined {
  const selected = Object.entries(stories).filter(([id]) => manifestStoryIds.has(id));
  return selected.length > 0 ? Object.fromEntries(selected) : undefined;
}
