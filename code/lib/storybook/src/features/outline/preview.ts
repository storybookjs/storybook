import { definePreviewAddon } from 'storybook/internal/csf';

import { getFeatures } from '@storybook/core/preview-api';

import { PARAM_KEY } from './constants.ts';
import type { OutlineTypes } from './types.ts';
import { withOutline } from './withOutline.ts';

export const decorators = getFeatures().outline ? [withOutline] : [];

export const initialGlobals = {
  [PARAM_KEY]: false,
};

export type { OutlineTypes };

export default definePreviewAddon<OutlineTypes>({ decorators, initialGlobals });
