import { type StoryContext, type SvelteRenderer } from './public-types';
import { type BaseAnnotations } from 'storybook/internal/types';

export const mount: BaseAnnotations<SvelteRenderer>['mount'] = (context: StoryContext) => {
  return async (Component, options) => {
    if (Component) {
      context.originalStoryFn = () => ({
        Component,
        props: options && 'props' in options ? options?.props : options,
      });
    }
    await context.renderToCanvas();
    return context.canvas;
  };
};
