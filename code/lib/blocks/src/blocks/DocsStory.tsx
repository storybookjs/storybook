import type { FC } from 'react';
import React from 'react';

import { Anchor } from './Anchor';
import { Canvas } from './Canvas';
import { Description } from './Description';
import { Subheading } from './Subheading';
import type { DocsStoryProps } from './types';
import { useOf } from './useOf';

export const DocsStory: FC<DocsStoryProps> = ({
  of,
  expanded = true,
  withToolbar: withToolbarProp = false,
  __forceInitialArgs = false,
  __primary = false,
}) => {
  const { story } = useOf(of || 'story', ['story']);

  // use withToolbar from parameters or default to true in autodocs
  const withToolbar = story.parameters.docs?.canvas?.withToolbar ?? withToolbarProp;

  return (
    <Anchor storyId={story.id}>
      {expanded && (
        <>
          <Subheading>{story.name}</Subheading>
          <Description of={of} />
        </>
      )}
      <Canvas
        of={of}
        withToolbar={withToolbar}
        story={{ __forceInitialArgs, __primary }}
        source={{ __forceInitialArgs }}
      />
    </Anchor>
  );
};
