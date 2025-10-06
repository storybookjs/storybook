import { definePreviewAddon } from 'storybook/internal/csf';

import { PARAM_KEY } from './constants';
import { withBackgroundAndGrid } from './decorator';
import type { BackgroundTypes, BackgroundsParameters, GlobalState } from './types';

const decorators = globalThis.FEATURES?.backgrounds ? [withBackgroundAndGrid] : [];

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

export type { BackgroundTypes };

export default () =>
  definePreviewAddon<BackgroundTypes>({
    decorators,
    parameters,
    initialGlobals,
  });
