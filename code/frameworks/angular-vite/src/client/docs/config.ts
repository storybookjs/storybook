import { SourceType } from 'storybook/internal/docs-tools';
import type { DecoratorFunction, Parameters } from 'storybook/internal/types';

import { sourceDecorator } from './sourceDecorator';

export const parameters: Parameters = {
  docs: {
    source: {
      type: SourceType.DYNAMIC,
      language: 'html',
    },
  },
};

// With the server-side docs path on, `story-docs` emits the snippet for every story. Leaving the
// client decorator registered would have two generators calling `emitTransformCode` for the same
// story with nothing coordinating them. Same gate React puts on its own legacy snippet path.
const useStaticServiceSnippets =
  'FEATURES' in globalThis && globalThis?.FEATURES?.experimentalDocgenServer;

export const decorators: DecoratorFunction[] = useStaticServiceSnippets ? [] : [sourceDecorator];
