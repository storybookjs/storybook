import type { StoryIndex } from 'storybook/internal/types';

import type { PreviewStoriesOutput } from './definition.ts';
import { findStoryIds } from './find-story-ids.ts';
import { type StoryInput, storyQuerySuffix } from './story-input.ts';

export type PreviewStoriesParams = {
  origin: string;
  index: StoryIndex;
  stories: StoryInput[];
};

/**
 * Resolves story selectors to preview URLs (and per-input errors).
 *
 * Pure helper: callers supply origin + index; no I/O.
 */
export function previewStories({
  origin,
  index,
  stories,
}: PreviewStoriesParams): Pick<PreviewStoriesOutput, 'stories'> {
  const resolvedStories = findStoryIds(index, stories);
  const result: PreviewStoriesOutput['stories'] = [];

  for (const story of resolvedStories) {
    if ('errorMessage' in story) {
      result.push({
        input: story.input,
        error: story.errorMessage,
      });
      continue;
    }

    const indexEntry = story.entry;
    const previewUrl = `${origin}/?path=/story/${indexEntry.id}${storyQuerySuffix(story.input)}`;

    result.push({
      title: indexEntry.title,
      name: indexEntry.name,
      previewUrl,
    });
  }

  return { stories: result };
}
