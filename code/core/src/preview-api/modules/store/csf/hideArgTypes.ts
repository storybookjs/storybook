import { ArgTypesRemovedFromStoryContextError } from 'storybook/internal/preview-errors';
import type { Renderer, StoryContext, StrictArgTypes } from 'storybook/internal/types';

const HIDDEN_KEY = 'argTypes';

// Registered globally: a preview can hold two copies of this module, which must share the key.
const STORY_ARG_TYPES = Symbol.for('storybook.internal.storyArgTypes');

const hiddenContexts = new WeakMap<object, object>();

/** Read the story's argTypes from a story context, including one that hides `argTypes`. */
export function getStoryArgTypes<TRenderer extends Renderer, TArgs>(
  context: StoryContext<TRenderer, TArgs>
): StrictArgTypes<TArgs> {
  return STORY_ARG_TYPES in context
    ? (context[STORY_ARG_TYPES] as StrictArgTypes<TArgs>)
    : context[HIDDEN_KEY];
}

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
      if (key === STORY_ARG_TYPES) {
        return getStoryArgTypes(target);
      }
      if (key === 'context') {
        return receiver;
      }
      return Reflect.get(target, key, receiver);
    },
    has(target, key) {
      return key === STORY_ARG_TYPES || (key !== HIDDEN_KEY && Reflect.has(target, key));
    },
    ownKeys(target) {
      return [
        ...Reflect.ownKeys(target).filter((key) => key !== HIDDEN_KEY && key !== STORY_ARG_TYPES),
        STORY_ARG_TYPES,
      ];
    },
    getOwnPropertyDescriptor(target, key) {
      if (key === HIDDEN_KEY) {
        return undefined;
      }
      if (key === STORY_ARG_TYPES) {
        return { value: getStoryArgTypes(target), enumerable: true, configurable: true };
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });

  hiddenContexts.set(context, hidden);
  hiddenContexts.set(hidden, hidden);
  return hidden;
}
