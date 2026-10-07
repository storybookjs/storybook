import type { StoryIndex } from 'storybook/internal/types';

import type { EmbedStoriesOutput } from './definition.ts';
import { findStoryIds } from './find-story-ids.ts';
import { type StoryInput, storyQueryParams } from './story-input.ts';

export type EmbedStoriesParams = {
  embedOrigin: string;
  index: StoryIndex;
  stories: StoryInput[];
};

export function embedStories({
  embedOrigin,
  index,
  stories,
}: EmbedStoriesParams): EmbedStoriesOutput {
  return {
    stories: findStoryIds(index, stories).map((story) =>
      'errorMessage' in story
        ? { input: story.input, error: story.errorMessage }
        : {
            title: story.entry.title,
            name: story.entry.name,
            embedUrl: `${embedOrigin}/iframe.html?id=${story.entry.id}&viewMode=story${storyQueryParams(story.input)}`,
          }
    ),
  };
}
