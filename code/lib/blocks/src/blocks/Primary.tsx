import type { FC } from 'react';
import React, { useContext } from 'react';

import { DocsContext } from './DocsContext';
import { DocsStory } from './DocsStory';
import type { Of } from './useOf';
import { useOf } from './useOf';

interface PrimaryProps {
  /** Specify where to get the primary story from. */
  of?: Of;
}

export const Primary: FC<PrimaryProps> = (props) => {
  const { of } = props;
  if ('of' in props && of === undefined) {
    throw new Error('Unexpected `of={undefined}`, did you mistype a CSF file reference?');
  }

  const { csfFile } = useOf(of || 'meta', ['meta']);
  const context = useContext(DocsContext);

  const primaryStory = context.componentStoriesFromCSFFile(csfFile)[0];

  return primaryStory ? (
    <DocsStory of={primaryStory.moduleExport} expanded={false} __primary withToolbar />
  ) : null;
};
