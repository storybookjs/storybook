import React from 'react';

import type { DecoratorFunction, LegacyStoryFn } from 'storybook/internal/types';

import { defaultDecorateStory } from 'storybook/preview-api';

import type { ReactRenderer } from './types.ts';

/*
 * With RSC on, the story's output gets its own Suspense boundary. If the only boundary sat above
 * the story function, React would call the story function again once a suspended child resolves.
 * By then Storybook has cleared the hooks context, so hooks like useArgs would throw.
 */
const SuspendedStory = ({
  storyFn,
  context,
}: {
  storyFn: LegacyStoryFn<ReactRenderer>;
  context: Parameters<LegacyStoryFn<ReactRenderer>>[0];
}) => React.createElement(React.Suspense, null, storyFn(context));

export const applyDecorators = (
  storyFn: LegacyStoryFn<ReactRenderer>,
  decorators: DecoratorFunction<ReactRenderer>[]
): LegacyStoryFn<ReactRenderer> => {
  return defaultDecorateStory(
    (context) =>
      context.parameters?.react?.rsc
        ? React.createElement(SuspendedStory, { storyFn, context })
        : React.createElement(storyFn, context),
    decorators
  );
};
