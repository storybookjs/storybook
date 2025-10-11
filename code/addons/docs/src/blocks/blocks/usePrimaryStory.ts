import { useContext } from 'react';

import type { PreparedStory } from 'storybook/internal/types';

import { DocsContext } from './DocsContext';

/**
 * A hook to get the primary story for the current component It filters out stories with the
 * '!autodocs' tag.
 */
export const usePrimaryStory = (): PreparedStory | undefined => {
  const context = useContext(DocsContext);
  const stories = context.componentStories();
  return stories.find((story) => story.tags.includes('autodocs'));
};
