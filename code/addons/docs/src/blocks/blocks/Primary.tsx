import type { FC } from 'react';
import React from 'react';

import { DocsStory } from './DocsStory';
import { usePrimaryStory } from './usePrimaryStory';
import { withMdxComponentOverride } from './withMdxComponentOverride';

const PrimaryImpl: FC = () => {
  const primaryStory = usePrimaryStory();

  return primaryStory ? (
    <DocsStory of={primaryStory.moduleExport} expanded={false} __primary withToolbar />
  ) : null;
};

export const Primary = withMdxComponentOverride('Primary', PrimaryImpl);
