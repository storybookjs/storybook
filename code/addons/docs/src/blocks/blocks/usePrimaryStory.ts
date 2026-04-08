import { useContext } from 'react';

import { Tag } from 'storybook/internal/preview-api';
import type { PreparedStory } from 'storybook/internal/types';

import { DocsContext } from './DocsContext';

/**
 * A hook to get the primary story for the current component's doc page. It prefers the first story
 * that includes the 'autodocs' tag, falling back to the first story without an explicit '!autodocs'
 * tag for custom MDX docs pages.
 */
export const usePrimaryStory = (): PreparedStory | undefined => {
  const context = useContext(DocsContext);
  const stories = context.componentStories();
  return (
    stories.find((story) => story.tags.includes(Tag.AUTODOCS)) ??
    stories.find((story) => !story.tags.includes(`!${Tag.AUTODOCS}`))
  );
};
