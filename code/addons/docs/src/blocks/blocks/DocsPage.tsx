import type { FC } from 'react';
import React from 'react';

import { Controls } from './Controls';
import { Description } from './Description';
import { Primary } from './Primary';
import { Stories } from './Stories';
import { Subtitle } from './Subtitle';
import { Title } from './Title';
import { useDocsStories } from './useDocsStories.ts';
import { usePrimaryStory } from './usePrimaryStory.ts';

export const DocsPage: FC = () => {
  const primaryStory = usePrimaryStory();
  const isSingleStory = useDocsStories().every((story) => story.id === primaryStory?.id);

  return (
    <>
      <Title />
      <Subtitle />
      <Description of="meta" />
      {isSingleStory && primaryStory ? <Description of={primaryStory.moduleExport} /> : null}
      <Primary />
      <Controls />
      {isSingleStory ? null : <Stories />}
    </>
  );
};
