import type { DecoratorFunction, LoaderFunction, Renderer } from 'storybook/internal/types';
import { applyDecorators as reactApplyDecorators } from '@storybook/react/entry-preview-docs';

import type { TanStackParameters } from './types.ts';
import { tanstackRouteDecorator } from './routing/decorator.tsx';
import { routeComponentLoader } from './routing/loader.ts';

export const loaders: LoaderFunction<Renderer>[] = [routeComponentLoader];

export const applyDecorators = (
  storyFn: Parameters<typeof reactApplyDecorators>[0],
  allDecorators: DecoratorFunction[]
) => reactApplyDecorators(storyFn, [tanstackRouteDecorator, ...allDecorators]);

export const parameters: TanStackParameters = {
  tanstack: {},
};
