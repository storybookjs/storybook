import { definePreviewAddon } from 'storybook/internal/csf';

import { PARAM_KEY } from './constants';
import type { OutlineTypes } from './types';
import { withOutline } from './withOutline';

export const decorators = globalThis.FEATURES?.outline ? [withOutline] : [];

export const initialGlobals = {
  [PARAM_KEY]: false,
};

export type { OutlineTypes };

export default () => definePreviewAddon<OutlineTypes>({ decorators, initialGlobals });
