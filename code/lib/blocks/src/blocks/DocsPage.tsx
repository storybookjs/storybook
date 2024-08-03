import type { FC } from 'react';
import React from 'react';
import { Title } from './Title';
import { Subtitle } from './Subtitle';
import { Description } from './Description';
import { Primary } from './Primary';
import { Controls } from './Controls';
import { Stories } from './Stories';
import { useOf } from './useOf';

export const DocsPage: FC = () => {
  const resolvedOf = useOf('meta', ['meta']);
  const { stories } = resolvedOf.csfFile;
  const isSingleStory = Object.keys(stories).length === 1;

  return (
    <>
      <Title />
      <Subtitle />
      <Description of="meta" />
      {isSingleStory ? <Description of="story" /> : null}
      <Primary />
      <Controls />
      {isSingleStory ? null : <Stories />}
    </>
  );
};
