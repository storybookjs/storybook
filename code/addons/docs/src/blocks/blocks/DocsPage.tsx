import type { FC } from 'react';
import React from 'react';

import { Controls } from './Controls';
import { Description } from './Description';
import { Primary } from './Primary';
import { Stories } from './Stories';
import { Subtitle } from './Subtitle';
import { Title } from './Title';
import { useDocsStories } from './useDocsStories';

export const DocsPage: FC = () => {
  const stories = useDocsStories();
  const singleStory = stories.length === 1 ? stories[0] : undefined;

  return (
    <>
      <Title />
      <Subtitle />
      <Description of="meta" />
      {singleStory ? <Description of={singleStory.moduleExport} /> : null}
      <Primary />
      <Controls />
      {singleStory ? null : <Stories />}
    </>
  );
};
