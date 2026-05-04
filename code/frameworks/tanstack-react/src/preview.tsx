import type { DecoratorFunction, LoaderFunction, Renderer } from 'storybook/internal/types';
// @ts-expect-error untyped
import { applyDecorators as reactApplyDecorators } from '@storybook/react/entry-preview-docs';

import type { TanStackParameters } from './types.ts';
import { tanstackRouteDecorator } from './routing/decorator.tsx';
import { routeComponentLoader } from './routing/loader.ts';

export const loaders: LoaderFunction<Renderer>[] = [routeComponentLoader];

export const applyDecorators = (
  storyFn: Parameters<typeof reactApplyDecorators>[0],
  allDecorators: DecoratorFunction[]
) =>
  // reorder decorators so `jsxDecorator` is innermost, and `tanstackRouteDecorator` is just outside it
  // There is an issue if `tanstackRouteDecorator` is innermost. All stories crashes due to a bug with the jsxDecorator.
  reactApplyDecorators(storyFn, [
    tanstackRouteDecorator as DecoratorFunction,
    ...allDecorators,
  ] as Parameters<typeof reactApplyDecorators>[1]);

export const parameters: TanStackParameters = {
  tanstack: {},
};
