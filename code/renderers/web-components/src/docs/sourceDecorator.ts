/* eslint-disable no-underscore-dangle */
import { SNIPPET_RENDERED, SourceType } from 'storybook/internal/docs-tools';
import type { ArgsStoryFn, PartialStoryFn, StoryContext } from 'storybook/internal/types';

import { render } from 'lit';
import { addons, useEffect, useState, useTransformCode } from 'storybook/preview-api';

import type { WebComponentsRenderer } from '../types';

// Taken from https://github.com/lit/lit/blob/main/packages/lit-html/src/test/test-utils/strip-markers.ts
const LIT_EXPRESSION_COMMENTS = /<!--\?lit\$[0-9]+\$-->|<!--\??-->/g;

function skipSourceRender(context: StoryContext<WebComponentsRenderer>) {
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

export function sourceDecorator(
  storyFn: PartialStoryFn<WebComponentsRenderer>,
  context: StoryContext<WebComponentsRenderer>
): WebComponentsRenderer['storyResult'] {
  const story = storyFn();
  const renderedForSource = context?.parameters.docs?.source?.excludeDecorators
    ? (context.originalStoryFn as ArgsStoryFn<WebComponentsRenderer>)(context.args, context)
    : story;

  const [source, setSource] = useState<undefined | string>(undefined);

  const transformedCode = useTransformCode(source, context);

  useEffect(() => {
    const { id, unmappedArgs } = context;

    if (source) {
      addons.getChannel().emit(SNIPPET_RENDERED, {
        id,
        source: transformedCode,
        args: unmappedArgs,
      });
    }
  });

  if (!skipSourceRender(context)) {
    const container = window.document.createElement('div');
    if (renderedForSource instanceof DocumentFragment) {
      render(renderedForSource.cloneNode(true), container);
    } else {
      render(renderedForSource, container);
    }
    const newSource = container.innerHTML.replace(LIT_EXPRESSION_COMMENTS, '');

    if (newSource != source) {
      setSource(newSource);
    }
  }

  return story;
}
