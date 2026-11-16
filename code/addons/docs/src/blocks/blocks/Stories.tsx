import type { FC, ReactElement } from 'react';
import React from 'react';

import { DocsStory } from './DocsStory';
import { Heading } from './Heading';
import { useDocsStories } from './useDocsStories.ts';
import { withMdxComponentOverride } from './with-mdx-component-override';

interface StoriesProps {
  title?: ReactElement | string;
  includePrimary?: boolean;
}

const StoriesImpl: FC<StoriesProps> = ({ title = 'Stories', includePrimary = true }) => {
  let stories = useDocsStories();

  if (!includePrimary) {
    stories = stories.slice(1);
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
