import type { Addon_DecoratorFunction } from 'storybook/internal/types';
import { withBackground } from './decorators/withBackground';
import { withGrid } from './decorators/withGrid';
import { PARAM_KEY } from './constants';

export const decorators: Addon_DecoratorFunction[] = [withGrid, withBackground];
export const parameters = {
  [PARAM_KEY]: {
    grid: {
      cellSize: 20,
      opacity: 0.5,
      cellAmount: 5,
    },
    values: [
      { name: 'light', value: '#F8F8F8' },
      { name: 'dark', value: '#333333' },
    ],
  },
};

export const initialGlobals = {
  [PARAM_KEY]: null as any,
};
