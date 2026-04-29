import type { Decorator } from '@storybook/react';
import type { DecoratorFunction, LoaderFunction, Renderer } from 'storybook/internal/types';
import { defaultDecorateStory } from 'storybook/preview-api';

import type { TanStackParameters } from './types.ts';
import { tanstackRouteDecorator } from './routing/decorator.tsx';
import { routeComponentLoader } from './routing/loader.ts';

export const loaders: LoaderFunction<Renderer>[] = [routeComponentLoader];
/**
 * Ensure the tanstack router decorator always runs last (innermost), so it wraps
 * the story directly — after all user and component decorators have run.
 */
export const applyDecorators = (
  storyFn: Parameters<typeof defaultDecorateStory>[0],
  allDecorators: DecoratorFunction[]
) => {
  return defaultDecorateStory(storyFn, [tanstackRouteDecorator, ...allDecorators]);
};

export const parameters: TanStackParameters = {
  tanstack: {},
};
