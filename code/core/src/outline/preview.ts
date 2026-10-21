import { definePreviewAddon } from 'storybook/internal/csf';

import { PARAM_KEY } from './constants.ts';
import type { OutlineTypes } from './types.ts';
import { applyOutline } from './applyOutline.ts';

const beforeEach = globalThis.FEATURES?.outline ? [applyOutline] : [];

export const initialGlobals = {
  [PARAM_KEY]: false,
};

export type { OutlineTypes };

export default () => definePreviewAddon<OutlineTypes>({ beforeEach, initialGlobals });
