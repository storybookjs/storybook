import type { Addon_DecoratorFunction } from 'storybook/internal/types';
import { withMeasure } from './withMeasure';
import { PARAM_KEY } from './constants';

export const decorators: Addon_DecoratorFunction[] = [withMeasure];

export const initialGlobals = {
  [PARAM_KEY]: false,
};
