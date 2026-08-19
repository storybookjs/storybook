import { SourceType } from 'storybook/internal/docs-tools';
import type { DecoratorFunction, Parameters } from 'storybook/internal/types';

import { registerSnippetRecipeRenderer } from 'storybook/open-service';

import { isStorySnippetRecipe, renderSnippetFromRecipe } from '../../story-snippet-recipe.ts';
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

// The server ships a snippet plus the recipe it was built from; rebuilding that recipe here, with
// the args the reader is looking at, is what makes the snippet follow the Controls. The layout is
// decided by the same builder on both sides, so an untouched story rebuilds byte for byte.
if (useStaticServiceSnippets) {
  registerSnippetRecipeRenderer((recipe, args) =>
    isStorySnippetRecipe(recipe) ? renderSnippetFromRecipe(recipe, args) : undefined
  );
}
