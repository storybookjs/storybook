import { ArgTypesRemovedFromStoryContextError } from 'storybook/internal/preview-errors';
import type { Renderer, StoryContext, StoryContextForRender } from 'storybook/internal/types';

const HIDDEN_KEY = 'argTypes';

export function hideArgTypes<TRenderer extends Renderer>(
  context: StoryContextForRender<TRenderer>
): StoryContext<TRenderer> {
  return new Proxy(context, {
    get(target, key, receiver) {
      if (key === HIDDEN_KEY) {
        throw new ArgTypesRemovedFromStoryContextError({ storyId: target.id });
      }
      if (key === 'context') {
        return receiver;
      }
      return Reflect.get(target, key, receiver);
    },
    has(target, key) {
      return key !== HIDDEN_KEY && Reflect.has(target, key);
    },
    ownKeys(target) {
      return Reflect.ownKeys(target).filter((key) => key !== HIDDEN_KEY);
    },
    getOwnPropertyDescriptor(target, key) {
      return key === HIDDEN_KEY ? undefined : Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
}
