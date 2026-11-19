import { ArgTypesRemovedFromStoryContextError } from 'storybook/internal/preview-errors';
import type { Renderer, StoryContext, StoryContextForRender } from 'storybook/internal/types';

const HIDDEN_KEYS = new Set<PropertyKey>(['argTypes', 'uninferredArgTypes']);

export function hideArgTypes<TRenderer extends Renderer>(
  context: StoryContextForRender<TRenderer>
): StoryContext<TRenderer> {
  return new Proxy(context, {
    get(target, key, receiver) {
      if (HIDDEN_KEYS.has(key)) {
        throw new ArgTypesRemovedFromStoryContextError({ storyId: target.id });
      }
      if (key === 'context') {
        return receiver;
      }
      return Reflect.get(target, key, receiver);
    },
    has(target, key) {
      return !HIDDEN_KEYS.has(key) && Reflect.has(target, key);
    },
    ownKeys(target) {
      return Reflect.ownKeys(target).filter((key) => !HIDDEN_KEYS.has(key));
    },
    getOwnPropertyDescriptor(target, key) {
      return HIDDEN_KEYS.has(key) ? undefined : Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
}
