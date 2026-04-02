import type { Decorator } from '@storybook/react';

import type { TanStackParameters } from './types';
import { tanstackRouteDecorator } from './routing/decorator';
import { tanstackQueryDecorator } from './query/decorator';

export const decorators: Decorator[] = [tanstackQueryDecorator, tanstackRouteDecorator];

export const parameters: TanStackParameters = {
  // Default tanstack parameters
  tanstack: {},
};
