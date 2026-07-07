import type { PreparedStory, TagOptions } from 'storybook/internal/types';

const excludeTags = Object.fromEntries(
  Object.entries<Partial<TagOptions>>(globalThis.TAGS_OPTIONS ?? {})
    .filter(([, { excludeFromDocsStories }]) => excludeFromDocsStories)
    .map(([tag, { excludeFromDocsStories }]) => [tag, excludeFromDocsStories])
);

export const parameters: any = {
  docs: {
    renderer: async () => {
      const { DocsRenderer } = (await import('./DocsRenderer')) as any;
      return new DocsRenderer();
    },
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
