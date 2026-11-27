import { SourceType, getSourceSnippetRuntime } from 'storybook/internal/docs-tools';
import type { DecoratorFunction, Parameters } from 'storybook/internal/types';

import './register-print-hole.ts';
import { sourceDecorator } from './sourceDecorator';

// Read at module scope because the preview's <head> assigns `FEATURES` from a blocking script,
// before any preview module evaluates.
const snippetRuntime = getSourceSnippetRuntime();

export const parameters: Parameters = {
  docs: {
    source: {
      type: SourceType.DYNAMIC,
      // The server snippet is the TypeScript host component that renders the story.
      language: snippetRuntime === 'server' ? 'ts' : 'html',
    },
  },
};

export const decorators: DecoratorFunction[] =
  snippetRuntime === 'preview' ? [sourceDecorator] : [];
