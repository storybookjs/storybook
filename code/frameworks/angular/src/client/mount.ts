import { StoryContext, AngularRenderer } from './public-types';
import { BaseAnnotations } from 'storybook/internal/types';
import { StoryFnAngularReturnType } from './types';

export const mount: BaseAnnotations<AngularRenderer>['mount'] =
  (context: StoryContext) => async (story: StoryFnAngularReturnType) => {
    if (story != null) {
      context.originalStoryFn = (): StoryFnAngularReturnType => story;
    }
    await context.renderToCanvas();
    return context.canvas;
  };
