import type { Addon_DecoratorFunction } from 'storybook/internal/types';

import { PARAM_KEY } from './constants';
import { withMeasure } from './withMeasure';

export const decorators: Addon_DecoratorFunction[] = [withMeasure];

export const initialGlobals = {
  [PARAM_KEY]: false,
};
