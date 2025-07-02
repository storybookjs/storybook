import { definePreviewAddon } from 'storybook/internal/csf';

import { PARAM_KEY } from './constants';
import type { GlobalState, ViewportTypes } from './types';

export const initialGlobals: Record<string, GlobalState> = {
  [PARAM_KEY]: { value: undefined, isRotated: false },
};

export type { ViewportTypes };

export default () =>
  definePreviewAddon<ViewportTypes>({
    initialGlobals,
  });
