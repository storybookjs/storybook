import { useContext } from 'react';

import { Tag } from 'storybook/internal/preview-api';
import type { PreparedStory } from 'storybook/internal/types';

import { DocsContext } from './DocsContext';

/**
 * Returns the primary story for the current docs page. Autodocs pages pick the first story tagged
 * `autodocs`; MDX or custom pages pick the first story regardless of tag (driven by
 * `DocsContext.filterByAutodocs`, set in `Docs.tsx`).
 */
export const usePrimaryStory = (): PreparedStory | undefined => {
  const context = useContext(DocsContext);
  const stories = context.componentStories();
  if (context.filterByAutodocs === false) {
    return stories[0];
  }
  return stories.find((story) => story.tags.includes(Tag.AUTODOCS));
};
