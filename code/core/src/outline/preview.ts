import { definePreviewAddon } from 'storybook/internal/csf';

import { PARAM_KEY } from './constants.ts';
import type { OutlineTypes } from './types.ts';
import { withOutline } from './withOutline.ts';

export const decorators = globalThis.FEATURES?.outline ? [withOutline] : [];

export const initialGlobals = {
  [PARAM_KEY]: false,
};

export type { OutlineTypes };

export default () => definePreviewAddon<OutlineTypes>({ decorators, initialGlobals });
