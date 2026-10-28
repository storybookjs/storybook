import { definePreviewAddon } from 'storybook/internal/csf';

import { PARAM_KEY } from '@storybook/core/internal/deep/shared/viewport/constants';
import type {
  GlobalState,
  ViewportGlobals,
  ViewportTypes,
} from '@storybook/core/internal/deep/shared/viewport/types';

export const initialGlobals: Record<string, GlobalState> = {
  [PARAM_KEY]: { value: undefined, isRotated: false },
};

export type { ViewportGlobals, ViewportTypes };

export default () =>
  definePreviewAddon<ViewportTypes>({
    initialGlobals,
  });
