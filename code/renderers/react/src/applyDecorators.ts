import React from 'react';

import type {
  DecoratorFunction,
  LegacyStoryFn,
  StoryContextForRender,
} from 'storybook/internal/types';

import { defaultDecorateStory } from 'storybook/preview-api';

import type { ReactRenderer } from './types.ts';

// The story function is called here, outside the boundary, so a suspended child that resumes does
// not make React call it again after Storybook has cleared the hooks context. The outer RSC
// boundary in entry-preview.tsx is separate and catches suspending decorators.
const StoryWithSuspenseBoundary = ({
  storyFn,
  context,
}: {
  storyFn: LegacyStoryFn<ReactRenderer>;
  context: StoryContextForRender<ReactRenderer>;
}) => React.createElement(React.Suspense, null, storyFn(context));

export const applyDecorators = (
  storyFn: LegacyStoryFn<ReactRenderer>,
  decorators: DecoratorFunction<ReactRenderer>[]
): LegacyStoryFn<ReactRenderer> => {
  return defaultDecorateStory(
    (context) =>
      context.parameters?.react?.rsc
        ? React.createElement(StoryWithSuspenseBoundary, { storyFn, context })
        : React.createElement(storyFn, context),
    decorators
  );
};
