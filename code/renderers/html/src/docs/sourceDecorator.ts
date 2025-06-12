import { SourceType } from 'storybook/internal/docs-tools';
import type { DecoratorFunction } from 'storybook/internal/types';

import { emitTransformCode, useEffect, useRef } from 'storybook/preview-api';

import type { StoryFn } from '../public-types';
import type { HtmlRenderer } from '../types';

function skipSourceRender(context: Parameters<DecoratorFunction<HtmlRenderer>>[1]) {
  const sourceParams = context?.parameters.docs?.source;
  const isArgsStory = context?.parameters.__isArgsStory;

  // always render if the user forces it
  if (sourceParams?.type === SourceType.DYNAMIC) {
    return false;
  }

  // never render if the user is forcing the block to render code, or
  // if the user provides code, or if it's not an args story.
  return !isArgsStory || sourceParams?.code || sourceParams?.type === SourceType.CODE;
}

export const sourceDecorator: DecoratorFunction<HtmlRenderer> = (storyFn, context) => {
  const source = useRef<string | undefined>(undefined);
  const story = storyFn();

  useEffect(() => {
    const renderedForSource = context?.parameters.docs?.source?.excludeDecorators
      ? (context.originalStoryFn as StoryFn)(context.args, context)
      : story;

    if (!skipSourceRender(context)) {
      if (typeof renderedForSource === 'string' && source.current !== renderedForSource) {
        emitTransformCode(renderedForSource, context);
        source.current = renderedForSource;
      } else if (
        renderedForSource instanceof Element &&
        source.current !== renderedForSource.outerHTML
      ) {
        emitTransformCode(renderedForSource.outerHTML, context);
        source.current = renderedForSource.outerHTML;
      }
    }
  });

  return story;
};
