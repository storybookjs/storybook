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

const RENDERER_SYMBOL = Symbol.for('storybook.open-service.snippet-recipe-renderer');

type RendererGlobal = { [key: symbol]: SnippetRecipeRenderer | undefined };

/**
 * Registers the renderer that turns this framework's snippet recipes back into snippets.
 *
 * Anchored on a `globalThis` symbol for the same reason the service registry is: the published
 * bundles reach this module through more than one import path - the preview runtime inlines its own
 * copy, while a framework calls in through `storybook/open-service` - so a module-level variable
 * would leave the setter writing one copy and the reader checking another. The failure mode is
 * silent, and indistinguishable from the feature being switched off.
 *
 * There is one preview and one framework in it, so a second registration replaces the first.
 */
export function registerSnippetRecipeRenderer(register: SnippetRecipeRenderer): void {
  (globalThis as RendererGlobal)[RENDERER_SYMBOL] = register;
}

/** Test seam. Preview code never needs this: the preview is torn down with its iframe. */
export function clearSnippetRecipeRenderer(): void {
  (globalThis as RendererGlobal)[RENDERER_SYMBOL] = undefined;
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
  const renderer = (globalThis as RendererGlobal)[RENDERER_SYMBOL];
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
