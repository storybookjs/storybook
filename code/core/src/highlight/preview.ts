/* eslint-env browser */
import { definePreviewAddon } from 'storybook/internal/csf';

import { addons } from 'storybook/preview-api';

import type { HighLightTypes } from './types';
import { useHighlights } from './useHighlights';

if (globalThis?.FEATURES?.highlight && addons?.ready) {
  addons.ready().then(useHighlights);
}

export type { HighLightTypes };

export default () => definePreviewAddon<HighLightTypes>({});
