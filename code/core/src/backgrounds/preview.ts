import { definePreviewAddon } from 'storybook/internal/csf';

import { PARAM_KEY } from './constants.ts';
import { applyBackgroundAndGrid } from './applyBackgroundAndGrid.ts';
import type {
  BackgroundTypes,
  BackgroundsGlobals,
  BackgroundsParameters,
  GlobalState,
} from './types.ts';

const beforeEach = globalThis.FEATURES?.backgrounds ? [applyBackgroundAndGrid] : [];

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

export type { BackgroundTypes, BackgroundsGlobals };

export default () =>
  definePreviewAddon<BackgroundTypes>({
    beforeEach,
    parameters,
    initialGlobals,
  });
