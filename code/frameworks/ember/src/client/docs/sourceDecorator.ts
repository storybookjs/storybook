import { SourceType } from 'storybook/internal/docs-tools';
import type { ArgTypes, Args, DecoratorFunction } from 'storybook/internal/types';

import { emitTransformCode, useEffect, useRef } from 'storybook/preview-api';

import type { StoryFn } from '../public-types';
import type { EmberRenderer } from '../types';

function skipSourceRender(context: Parameters<DecoratorFunction<EmberRenderer>>[1]) {
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

export const sourceDecorator: DecoratorFunction<EmberRenderer> = (storyFn, context) => {
  const source = useRef<string | undefined>(undefined);
  const story = storyFn();

  useEffect(() => {
    const renderedForSource = context?.parameters.docs?.source?.excludeDecorators
      ? (context.originalStoryFn as StoryFn)(context.args, context)
      : story;

    if (!skipSourceRender(context)) {
      const code =
        generateGlimmerSource(renderedForSource, context.args, context.argTypes) ?? undefined;
      emitTransformCode(code, context);
      source.current = code;
    }
  });

  return story;
};

export function generateGlimmerSource(
  component: object & { name?: string },
  args: Args,
  argTypes: ArgTypes
): string | null {
  const name = component.name;
  if (!name) {
    return null;
  }

  const propsArray = Object.entries(args)
    .map(([k, v]) => toArgument(k, v, argTypes))
    .filter((p) => p);

  if (propsArray.length === 0) {
    return `<${name} />`;
  } else if (propsArray.length > 3) {
    return `<${name}\n  ${propsArray.join('\n  ')}\n/>`;
  }
  return `<${name} ${propsArray.join(' ')} />`;
}

function toArgument(key: string, value: unknown, argTypes: ArgTypes): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const argType = argTypes[key];

  // event should be skipped
  if (argType && argType.action) {
    return null;
  }

  if (typeof value === 'string') {
    return `@${key}=${JSON.stringify(value)}`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return `@${key}={{${JSON.stringify(value)}}}`;
  }

  return null;
}
