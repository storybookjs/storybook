import type { Addon_DecoratorFunction } from 'storybook/internal/types';

import { PARAM_KEY as KEY } from './constants';
import { withBackgroundAndGrid } from './decorator';
import { DEFAULT_BACKGROUNDS } from './defaults';
import { withBackground } from './legacy/withBackgroundLegacy';
import { withGrid } from './legacy/withGridLegacy';
import type { Config, GlobalState } from './types';

export const decorators: Addon_DecoratorFunction[] = FEATURES?.backgroundsStoryGlobals
  ? [withBackgroundAndGrid]
  : [withGrid, withBackground];

export const parameters = {
  [KEY]: {
    grid: {
      cellSize: 20,
      opacity: 0.5,
      cellAmount: 5,
    },
    disable: false,
    // TODO: remove in 9.0
    ...(!FEATURES?.backgroundsStoryGlobals && {
      values: Object.values(DEFAULT_BACKGROUNDS),
    }),
  } satisfies Partial<Config>,
};

const modern: Record<string, GlobalState> = {
  [KEY]: { value: undefined, grid: false },
};

export const initialGlobals = FEATURES?.backgroundsStoryGlobals ? modern : { [KEY]: null };
