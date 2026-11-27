import type { PreparedStory, TagOptions } from 'storybook/internal/types';

import { DocsRenderer } from './DocsRenderer.ts';

const excludeTags = Object.entries<Partial<TagOptions>>(globalThis.TAGS_OPTIONS ?? {}).reduce(
  (acc, [tag, option]) => {
    if (option.hideFromAutodocs) {
      acc[tag] = true;
    }
    return acc;
  },
  {} as Record<string, boolean>
);

export const parameters: any = {
  docs: {
    renderer: async () => new DocsRenderer(),
    stories: {
      filter: (story: PreparedStory) => {
        const tags = story.tags || [];
        return (
          tags.filter((tag) => excludeTags[tag]).length === 0 && !story.parameters.docs?.disable
        );
      },
    },
  },
};
