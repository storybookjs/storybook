import { definePreviewAddon, PreviewAddon } from 'storybook/internal/csf';

import { PARAM_KEY } from './constants.ts';
import type { GlobalState, ViewportGlobals, ViewportTypes } from './types.ts';

export const initialGlobals: Record<string, GlobalState> = {
  [PARAM_KEY]: { value: undefined, isRotated: false },
};

export type { ViewportGlobals, ViewportTypes };

export default (): PreviewAddon<ViewportTypes> =>
  definePreviewAddon<ViewportTypes>({
    initialGlobals,
  });
