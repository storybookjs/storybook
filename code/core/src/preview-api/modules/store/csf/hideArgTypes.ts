import { ArgTypesRemovedFromStoryContextError } from 'storybook/internal/preview-errors';
import type { Renderer, StoryContext } from 'storybook/internal/types';

const HIDDEN_KEY = 'argTypes';

const hiddenContexts = new WeakMap<object, object>();

export function hideArgTypes<TRenderer extends Renderer>(
  context: StoryContext<TRenderer>
): StoryContext<TRenderer> {
  const known = hiddenContexts.get(context) as StoryContext<TRenderer> | undefined;
  if (known) {
    return known;
  }

  // A proxy cannot hide a key of a frozen target, and React freezes the props it passes on.
  const target = Object.isExtensible(context) ? context : { ...context };

  const hidden = new Proxy(target, {
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

  hiddenContexts.set(context, hidden);
  hiddenContexts.set(hidden, hidden);
  return hidden;
}
