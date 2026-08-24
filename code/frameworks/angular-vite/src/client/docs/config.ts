import { SourceType } from 'storybook/internal/docs-tools';
import type { DecoratorFunction, Parameters } from 'storybook/internal/types';
import type { StoryDocsSnippetSourceParameters } from 'storybook/open-service';

import { renderSnippetFromTemplate } from '../../story-snippet-template.ts';
import { sourceDecorator } from './sourceDecorator';

// With the docgen server on, the Source block and Code panel show the story-docs snippet, which is
// the TypeScript host component that renders the story; without it they show the template the
// runtime source decorator builds. Read at module scope because the preview's <head> assigns
// `FEATURES` from a blocking script, before any preview module evaluates.
const useServiceSnippets = globalThis.FEATURES?.experimentalDocgenServer === true;
const snippetSourceParameters = {
  renderSnippetTemplate: renderSnippetFromTemplate,
} satisfies StoryDocsSnippetSourceParameters;

export const parameters: Parameters = {
  docs: {
    source: {
      type: SourceType.DYNAMIC,
      language: useServiceSnippets ? 'ts' : 'html',
      ...snippetSourceParameters,
    },
  },
};

export const decorators: DecoratorFunction[] = useServiceSnippets ? [] : [sourceDecorator];
