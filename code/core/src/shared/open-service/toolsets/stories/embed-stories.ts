import type { StoryIndex } from 'storybook/internal/types';

import { buildArgsParam } from '../../../../router/utils.ts';
import type { EmbedStoriesOutput } from './definition.ts';
import { findStoryIds } from './find-story-ids.ts';
import type { StoryInput } from './story-input.ts';

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
  const result: EmbedStoriesOutput['stories'] = [];

  for (const story of findStoryIds(index, stories)) {
    if ('errorMessage' in story) {
      result.push({ input: story.input, error: story.errorMessage });
      continue;
    }

    let embedUrl = `${embedOrigin}/iframe.html?id=${story.entry.id}&viewMode=story`;

    const argsParam = buildArgsParam({}, story.input.props ?? {});
    if (argsParam) {
      embedUrl += `&args=${argsParam}`;
    }

    const globalsParam = buildArgsParam({}, story.input.globals ?? {});
    if (globalsParam) {
      embedUrl += `&globals=${globalsParam}`;
    }

    result.push({ title: story.entry.title, name: story.entry.name, embedUrl });
  }

  return { stories: result };
}
