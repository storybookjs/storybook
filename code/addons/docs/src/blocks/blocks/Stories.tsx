import type { FC, ReactElement } from 'react';
import React, { useContext } from 'react';

import { Tag } from 'storybook/internal/preview-api';

import { DocsContext } from './DocsContext';
import { DocsStory } from './DocsStory';
import { Heading } from './Heading';
import { rendersInline } from './rendersInline.ts';
import { usePrimaryStory } from './usePrimaryStory';
import { withMdxComponentOverride } from './with-mdx-component-override';
import type { DocsParameters } from '../../types.ts';

interface StoriesProps {
  title?: ReactElement | string;
  /**
   * Whether the stories include the primary story. By default they do, except on an autodocs page
   * when it renders in an iframe: the `Primary` block shows it already.
   */
  includePrimary?: boolean;
}

const StoriesImpl: FC<StoriesProps> = ({ title = 'Stories', includePrimary }) => {
  const { componentStories, projectAnnotations, getStoryContext, filterByAutodocs } =
    useContext(DocsContext);
  const primaryStory = usePrimaryStory();

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

  if (includePrimary === false) {
    stories = stories.slice(1);
  } else if (
    includePrimary === undefined &&
    filterByAutodocs !== false &&
    primaryStory &&
    !rendersInline(primaryStory)
  ) {
    // An autodocs page shows the primary story under `Primary`; a second iframe would load a
    // second preview of it. An MDX file may have no `Primary` block, so it lists every story.
    stories = stories.filter((story) => story.id !== primaryStory.id);
  }

  if (!stories || stories.length === 0) {
    return null;
  }
  return (
    <>
      {typeof title === 'string' ? <Heading>{title}</Heading> : title}
      {stories.map(
        (story) =>
          story && <DocsStory key={story.id} of={story.moduleExport} expanded __forceInitialArgs />
      )}
    </>
  );
};

export const Stories = withMdxComponentOverride('Stories', StoriesImpl);
