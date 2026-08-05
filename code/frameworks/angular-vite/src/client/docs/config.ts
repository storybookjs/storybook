import { SourceType } from 'storybook/internal/docs-tools';
import type { DecoratorFunction, Parameters } from 'storybook/internal/types';

import { sourceDecorator } from './sourceDecorator';

// With the server-side docs path on, `story-docs` emits the snippet for every story. Leaving the
// client decorator registered would have two generators calling `emitTransformCode` for the same
// story with nothing coordinating them. Same gate React puts on its own legacy snippet path.
const useStaticServiceSnippets =
  'FEATURES' in globalThis && globalThis?.FEATURES?.experimentalDocgenServer;

export const parameters: Parameters = {
  docs: {
    source: {
      // `DYNAMIC` makes the Source block use the snippet unconditionally, which is right while the
      // client decorator guarantees one. The server provider does not: it returns nothing for a
      // story file it cannot resolve a component for, and `AUTO` is what lets the block fall back
      // to the story's own source instead of rendering empty.
      type: useStaticServiceSnippets ? SourceType.AUTO : SourceType.DYNAMIC,
      language: 'html',
    },
  },
};

export const decorators: DecoratorFunction[] = useStaticServiceSnippets ? [] : [sourceDecorator];
