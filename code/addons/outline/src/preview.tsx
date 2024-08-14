import type { Addon_DecoratorFunction } from 'storybook/internal/types';

import { PARAM_KEY } from './constants';
import { withOutline } from './withOutline';

export const decorators: Addon_DecoratorFunction[] = [withOutline];

export const initialGlobals = {
  [PARAM_KEY]: false,
};
