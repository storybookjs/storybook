/* eslint-env browser */
import { definePreviewAddon } from 'storybook/internal/csf';

import { addons } from '@storybook/core/preview-api';

import { getFeatures } from '@storybook/core/preview-api';
import type { HighlightTypes } from './types.ts';
import { useHighlights } from './useHighlights.ts';

if (getFeatures().highlight && addons?.ready) {
  addons.ready().then(useHighlights);
}

export type { HighlightTypes };

export default () => definePreviewAddon<HighlightTypes>({});
