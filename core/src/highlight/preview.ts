/* eslint-env browser */
import { definePreviewAddon } from 'storybook/internal/csf';

import { addons } from 'storybook/preview-api';

import type { HighlightTypes } from './types';
import { useHighlights } from './useHighlights';

if (globalThis?.FEATURES?.highlight && addons?.ready) {
  addons.ready().then(useHighlights);
}

export type { HighlightTypes };

export default () => definePreviewAddon<HighlightTypes>({});
