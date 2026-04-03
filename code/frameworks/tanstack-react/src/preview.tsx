import type { Decorator } from '@storybook/react';
import type { LoaderFunction, Renderer } from 'storybook/internal/types';

import type { TanStackParameters } from './types';
import { tanstackRouteDecorator } from './routing/decorator';
import { routeComponentLoader } from './routing/loader';

export const loaders: LoaderFunction<Renderer>[] = [routeComponentLoader];

export const decorators: Decorator[] = [tanstackRouteDecorator];

export const parameters: TanStackParameters = {
  tanstack: {},
};
