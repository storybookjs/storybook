import { type StoryContext, type ReactRenderer } from './public-types';
import type { BaseAnnotations } from 'storybook/internal/types';

export const mount: BaseAnnotations<ReactRenderer>['mount'] =
  (context: StoryContext) => async (ui) => {
    if (ui != null) {
      context.originalStoryFn = () => ui;
    }
    await context.renderToCanvas();
    return context.canvas;
  };
