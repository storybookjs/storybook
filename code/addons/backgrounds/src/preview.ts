import type { Addon_DecoratorFunction } from 'storybook/internal/types';
import { withBackground } from './legacy/withBackgroundLegacy';
import { withGrid } from './legacy/withGridLegacy';
import { PARAM_KEY as KEY } from './constants';
import { withBackgroundAndGrid } from './decorator';
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
    ...(FEATURES?.backgroundsStoryGlobals
      ? {
          options: {
            light: { name: 'light', value: '#F8F8F8' },
            dark: { name: 'dark', value: '#333' },
          },
        }
      : {
          // TODO: remove in 9.0
          values: [
            { name: 'light', value: '#F8F8F8' },
            { name: 'dark', value: '#333333' },
          ],
        }),
  } satisfies Partial<Config>,
};

const modern: Record<string, GlobalState> = {
  [KEY]: { value: undefined, grid: false },
};

export const initialGlobals = FEATURES?.backgroundsStoryGlobals ? modern : { [KEY]: null };
