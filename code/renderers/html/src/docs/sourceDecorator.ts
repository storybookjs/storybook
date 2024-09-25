/* eslint-disable no-underscore-dangle */
import { SNIPPET_RENDERED, SourceType } from 'storybook/internal/docs-tools';
import { addons, useEffect } from 'storybook/internal/preview-api';
import type { DecoratorFunction } from 'storybook/internal/types';

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
  const story = storyFn();
  const renderedForSource = context?.parameters.docs?.source?.excludeDecorators
    ? (context.originalStoryFn as StoryFn)(context.args, context)
    : story;

  let source: string | undefined;
  if (!skipSourceRender(context)) {
    if (typeof renderedForSource === 'string') {
      source = renderedForSource;
    } else if (renderedForSource instanceof Element) {
      source = renderedForSource.outerHTML;
    }
  }
  useEffect(() => {
    const { id, unmappedArgs } = context;

    if (source) {
      addons.getChannel().emit(SNIPPET_RENDERED, { id, args: unmappedArgs, source });
    }
  });

  return story;
};
