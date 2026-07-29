import type { StoryIndex } from 'storybook/internal/types';

import { buildArgsParam } from '../../../../router/utils.ts';
import type { PreviewStoriesOutput } from './definition.ts';
import { findStoryIds } from './find-story-ids.ts';
import type { StoryInput } from './story-input.ts';

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
}: PreviewStoriesParams): PreviewStoriesOutput {
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

    const indexEntry = index.entries[story.id];
    if (!indexEntry) {
      result.push({
        input: story.input,
        error: `No story found for story ID "${story.id}"`,
      });
      continue;
    }

    let previewUrl = `${origin}/?path=/story/${story.id}`;

    const argsParam = buildArgsParam({}, story.input.props ?? {});
    if (argsParam) {
      previewUrl += `&args=${argsParam}`;
    }

    const globalsParam = buildArgsParam({}, story.input.globals ?? {});
    if (globalsParam) {
      previewUrl += `&globals=${globalsParam}`;
    }

    result.push({
      title: indexEntry.title,
      name: indexEntry.name,
      previewUrl,
    });
  }

  return { stories: result };
}
