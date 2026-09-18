import type { DecoratorFunction, PartialStoryFn, StoryContext } from 'storybook/internal/types';

// The controls addon doesn't need a decorator as it operates through the manager UI
// This is a placeholder to maintain API compatibility
export const withControls: DecoratorFunction = (storyFn: PartialStoryFn, context: StoryContext) => {
  return storyFn(context);
};
