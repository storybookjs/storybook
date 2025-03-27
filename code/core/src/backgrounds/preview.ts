import { definePreview } from 'storybook/preview-api';

import { PARAM_KEY } from './constants';
import { withBackgroundAndGrid } from './decorator';
import type { BackgroundsParameters, GlobalState } from './types';

const decorators = [withBackgroundAndGrid];

const parameters = {
  [PARAM_KEY]: {
    grid: {
      cellSize: 20,
      opacity: 0.5,
      cellAmount: 5,
    },
    disable: false,
  },
} satisfies Partial<BackgroundsParameters>;

const initialGlobals: Record<string, GlobalState> = {
  [PARAM_KEY]: { value: undefined, grid: false },
};


export default () =>
  definePreview({
    decorators,
    parameters,
    initialGlobals,
  });
