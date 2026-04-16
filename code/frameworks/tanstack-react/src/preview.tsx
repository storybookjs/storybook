import type { Decorator } from '@storybook/react';
import type { LoaderFunction, Renderer } from 'storybook/internal/types';

import type { TanStackParameters } from './types.ts';
import { tanstackRouteDecorator } from './routing/decorator.tsx';
import { routeComponentLoader } from './routing/loader.ts';

export const loaders: LoaderFunction<Renderer>[] = [routeComponentLoader];

export const decorators: Decorator[] = [tanstackRouteDecorator];

export const parameters: TanStackParameters = {
  tanstack: {},
};
