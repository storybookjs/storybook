import { useContext } from 'react';

import { Tag } from 'storybook/internal/preview-api';
import type { PreparedStory } from 'storybook/internal/types';

import { DocsContext } from './DocsContext.ts';
import type { DocsParameters } from '../../types.ts';

/** Returns the stories the `Stories` block renders for the current docs page. */
export const useDocsStories = (): PreparedStory[] => {
  const { componentStories, projectAnnotations, getStoryContext } = useContext(DocsContext);

  let stories = componentStories();
  const filter = (projectAnnotations.parameters as DocsParameters | undefined)?.docs?.stories
    ?.filter;
  if (filter) {
    stories = stories.filter((story) => filter(story, getStoryContext(story)));
  }
  // NOTE: this should be part of the default filter function. However, there is currently
  // no way to distinguish a Stories block in an autodocs page from Stories in an MDX file
  // making https://github.com/storybookjs/storybook/pull/26634 an unintentional breaking change.
  //
  // The new behavior here is that if NONE of the stories in the autodocs page are tagged
  // with 'autodocs', we show all stories. If ANY of the stories have autodocs then we use
  // the new behavior.
  const hasAutodocsTaggedStory = stories.some((story) => story.tags?.includes(Tag.AUTODOCS));
  if (hasAutodocsTaggedStory) {
    // Don't show stories where mount is used in docs.
    // As the play function is not running in docs, and when mount is used, the mounting is happening in play itself.
    stories = stories.filter((story) => story.tags?.includes(Tag.AUTODOCS) && !story.usesMount);
  }
  return stories;
};
