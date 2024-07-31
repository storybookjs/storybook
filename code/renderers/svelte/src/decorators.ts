import type { DecoratorFunction, StoryContext, LegacyStoryFn } from 'storybook/internal/types';
import { sanitizeStoryContextUpdate } from 'storybook/internal/preview-api';
/*
! DO NOT change this SlotDecorator import to a relative path, it will break it.
! A relative import will be compiled at build time, and Svelte will be unable to
! render the component together with the user's Svelte components
! importing from @storybook/svelte will make sure that it is compiled at runtime
! with the same bundle as the user's Svelte components
*/
import SlotDecorator from '@storybook/svelte/internal/SlotDecorator.svelte';
import type { SvelteRenderer } from './types';

/**
 * Handle component loaded with ESM or CJS,
 * by getting the 'default' property of the object if it exists.
 * @param obj object
 */
function unWrap<T>(obj: { default: T } | T): T {
  return obj && typeof obj === 'object' && 'default' in obj ? obj.default : obj;
}

/**
 * Prepare a story to be compatible with the PreviewRender component.
 *
 * - `() => ({ Component: MyComponent, props: ...})` is already prepared, kept as-is
 * - `() => MyComponent` is transformed to `() => ({ Component: MyComponent })`
 * - `() => ({})` is transformed to component from context with `() => ({ Component: context.component })`
 * - A decorator component is wrapped with SlotDecorator, injecting the decorated component in a <slot />
 *
 * @param context StoryContext
 * @param story  the current story
 * @param innerStory the story decorated by the current story
 */
function prepareStory(
  context: StoryContext<SvelteRenderer>,
  rawStory: SvelteRenderer['storyResult'],
  rawInnerStory?: SvelteRenderer['storyResult']
) {
  const story = unWrap(rawStory);
  const innerStory = rawInnerStory && unWrap(rawInnerStory);

  let preparedStory;

  if (!story || Object.keys(story).length === 0) {
    // story is empty or an empty object, use the component from the context
    preparedStory = {
      Component: context.component,
    };
  } else if (story.Component) {
    // the story is already prepared
    preparedStory = story;
  } else {
    // we must assume that the story is a Svelte component
    preparedStory = {
      Component: story,
    };
  }

  if (innerStory) {
    // render a SlotDecorator with innerStory as its regular component,
    // and the prepared story as the decorating component
    return {
      Component: SlotDecorator,
      props: {
        // inner stories will already have been prepared, keep as is
        ...innerStory,
        decorator: preparedStory,
      },
    };
  }

  return preparedStory;
}

export function decorateStory(storyFn: any, decorators: any[]) {
  return decorators.reduce(
    (decorated: LegacyStoryFn<SvelteRenderer>, decorator: DecoratorFunction<SvelteRenderer>) =>
      (context: StoryContext<SvelteRenderer>) => {
        let story: SvelteRenderer['storyResult'] | undefined;

        const decoratedStory: SvelteRenderer['storyResult'] = decorator((update) => {
          story = decorated({
            ...context,
            ...sanitizeStoryContextUpdate(update),
          });
          return story;
        }, context);

        if (!story) {
          story = decorated(context);
        }

        if (decoratedStory === story) {
          return story;
        }

        return prepareStory(context, decoratedStory, story);
      },
    (context: StoryContext<SvelteRenderer>) => prepareStory(context, storyFn(context))
  );
}
