import type { Decorator } from '@storybook/react';

import type { TanStackParameters } from './types';
import { tanstackRouteDecorator, tanstackRouteLoader } from './routing/decorator';
import { tanstackQueryDecorator, tanstackQueryLoader } from './query/decorator';

export const decorators: Decorator[] = [tanstackQueryDecorator, tanstackRouteDecorator];

export const loaders = [tanstackQueryLoader, tanstackRouteLoader];

export const parameters: TanStackParameters = {
  // Default tanstack parameters
  tanstack: {},
};
