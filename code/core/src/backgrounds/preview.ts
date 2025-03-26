import { definePreview } from 'storybook/preview-api';

import { PARAM_KEY as KEY } from './constants';
import { withBackgroundAndGrid } from './decorator';
import type { BackgroundsParameters, GlobalState } from './types';

export const decorators = [withBackgroundAndGrid];

export const parameters = {
  [KEY]: {
    grid: {
      cellSize: 20,
      opacity: 0.5,
      cellAmount: 5,
    },
    disable: false,
  },
} satisfies Partial<BackgroundsParameters>;

export const initialGlobals: Record<string, GlobalState> = {
  [KEY]: { value: undefined, grid: false },
};

export default () =>
  definePreview({
    decorators,
    parameters,
    initialGlobals,
  });
