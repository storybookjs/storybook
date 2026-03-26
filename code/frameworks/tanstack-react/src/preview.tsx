import type { Decorator } from '@storybook/react';

import type { TanStackParameters } from './types';
import { tanstackRouteDecorator } from './routing/decorator';

export const decorators: Decorator[] = [tanstackRouteDecorator];

export const parameters: TanStackParameters = {
  // Default tanstack parameters
  tanstack: {},
};
