import { SourceType } from 'storybook/internal/docs-tools';
import type { DecoratorFunction, Parameters } from 'storybook/internal/types';

import { registerSnippetTemplateRenderer } from 'storybook/open-service';

import { isStorySnippetTemplate, renderSnippetFromTemplate } from '../../story-snippet-template.ts';
import { sourceDecorator } from './sourceDecorator';

// With the docgen server on, the Source block and Code panel show the story-docs snippet, which is
// the TypeScript host component that renders the story; without it they show the template the
// runtime source decorator builds. Read at module scope because the preview's <head> assigns
// `FEATURES` from a blocking script, before any preview module evaluates.
const useStaticServiceSnippets = globalThis.FEATURES?.experimentalDocgenServer === true;

export const parameters: Parameters = {
  docs: {
    source: {
      type: SourceType.DYNAMIC,
      language: useStaticServiceSnippets ? 'ts' : 'html',
    },
  },
};

export const decorators: DecoratorFunction[] = useStaticServiceSnippets ? [] : [sourceDecorator];

// The server ships a snippet plus the template it was built from; filling that template here, with
// the args the reader is looking at, is what makes the snippet follow the Controls. The layout is
// decided by the same rule on both sides, so an untouched story rebuilds byte for byte.
if (useStaticServiceSnippets) {
  registerSnippetTemplateRenderer((snippetTemplate, args) =>
    isStorySnippetTemplate(snippetTemplate)
      ? renderSnippetFromTemplate(snippetTemplate, args)
      : undefined
  );
}
