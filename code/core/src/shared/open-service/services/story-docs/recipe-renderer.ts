import { once } from '../../../../client-logger/index.ts';
import type { Args } from '../../../../types/modules/csf.ts';
import type { StoryDoc } from './types.ts';

/**
 * Rebuilds a story's snippet from its framework-owned recipe and the args a reader is looking at.
 *
 * Returning `undefined` means "this recipe is not mine to render" and leaves the server's snippet in
 * place; throwing means the same, and is caught.
 */
export type SnippetRecipeRenderer = (recipe: unknown, args: Args) => string | undefined;

let renderer: SnippetRecipeRenderer | undefined;

/**
 * Registers the renderer that turns this framework's snippet recipes back into snippets.
 *
 * Called from the framework's preview annotation, the way {@link registerService} is. There is one
 * preview and one framework in it, so there is one renderer; a second registration replaces the
 * first rather than accumulating.
 */
export function registerSnippetRecipeRenderer(register: SnippetRecipeRenderer): void {
  renderer = register;
}

/** Test seam. Preview code never needs this: the preview is torn down with its iframe. */
export function clearSnippetRecipeRenderer(): void {
  renderer = undefined;
}

/**
 * The story's snippet for the args in front of the reader.
 *
 * Falls back to the snippet the server rendered whenever anything is missing or goes wrong: no
 * recipe, no framework renderer, a value the framework cannot print. A snippet that lags the
 * Controls is merely stale; one rebuilt from a half-understood recipe would be wrong, and wrong
 * source is not copy-pasteable.
 */
export function renderStoryDocSnippet(story: StoryDoc, args: Args | undefined): string | undefined {
  if (story.snippet === undefined) {
    return undefined;
  }
  if (story.recipe === undefined || args === undefined || renderer === undefined) {
    return story.snippet;
  }
  try {
    return renderer(story.recipe, args) ?? story.snippet;
  } catch (error) {
    once.warn(
      `Could not rebuild the code snippet for "${story.id}" from the current args, so it shows the story's declared args instead. ${String(error)}`
    );
    return story.snippet;
  }
}
