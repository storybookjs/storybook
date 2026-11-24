import { SourceType, getSourceSnippetRuntime } from 'storybook/internal/docs-tools';
import type { DecoratorFunction } from 'storybook/internal/types';

import { printHole } from './docs/print-hole.ts';
import { sourceDecorator } from './docs/sourceDecorator.ts';
import type { WebComponentsRenderer } from './types.ts';

const snippetRuntime = getSourceSnippetRuntime();

export const decorators: DecoratorFunction<WebComponentsRenderer>[] =
  snippetRuntime === 'preview' ? [sourceDecorator] : [];

export const parameters = {
  docs: {
    source: {
      type: SourceType.DYNAMIC,
      language: 'html',
      ...(snippetRuntime === 'server' ? { printHole } : {}),
    },
    story: { inline: true },
  },
};
