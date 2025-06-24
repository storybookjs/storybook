import React from 'react';

import type { DecoratorFunction, LegacyStoryFn } from 'storybook/internal/types';

import { defaultDecorateStory } from 'storybook/preview-api';

import type { ReactRenderer } from './types';

export const applyDecorators = (
  storyFn: LegacyStoryFn<ReactRenderer>,
  decorators: DecoratorFunction<ReactRenderer>[]
): LegacyStoryFn<ReactRenderer> => {
  return defaultDecorateStory((context) => React.createElement(storyFn, context), decorators);
};
