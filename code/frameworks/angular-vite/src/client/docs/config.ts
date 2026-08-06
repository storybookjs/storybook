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

// Two generators would otherwise call `emitTransformCode` for the same story with nothing
// coordinating them: `story-docs` covers snippets when the server-side docs path is on.
const useStaticServiceSnippets = globalThis.FEATURES?.experimentalDocgenServer;

export const decorators: DecoratorFunction[] = useStaticServiceSnippets ? [] : [sourceDecorator];
