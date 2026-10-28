import { SourceType } from 'storybook/internal/docs-tools';
import type { DecoratorFunction } from 'storybook/internal/types';

import { getFeatures } from 'storybook/preview-api';

import { sourceDecorator } from './docs/sourceDecorator.ts';
import type { WebComponentsRenderer } from './types.ts';

// The story-docs service owns the Code panel under the docgen server, so the runtime decorator must not emit over it.
const useStaticServiceSnippets = getFeatures().docgenServer;

export const decorators: DecoratorFunction<WebComponentsRenderer>[] = useStaticServiceSnippets
  ? []
  : [sourceDecorator];

export const parameters = {
  docs: {
    source: {
      type: SourceType.DYNAMIC,
      language: 'html',
    },
    story: { inline: true },
  },
};

export default { decorators, parameters };
