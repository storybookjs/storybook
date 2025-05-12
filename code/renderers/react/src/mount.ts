import type { BaseAnnotations } from 'storybook/internal/types';

import { type ReactRenderer, type StoryContext } from './public-types';

export const mount: BaseAnnotations<ReactRenderer>['mount'] =
  (context: StoryContext) => async (ui) => {
    if (ui != null) {
      context.originalStoryFn = () => ui;
    }
    await context.renderToCanvas();
    return context.canvas;
  };
