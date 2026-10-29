/* eslint-env browser */
import { definePreviewAddon } from 'storybook/internal/csf';

import { addons, getFeatures } from '@storybook/core/preview-api';

import type { HighlightTypes } from './types.ts';
import { useHighlights } from './useHighlights.ts';

export type { HighlightTypes };

export default definePreviewAddon<HighlightTypes>({
  beforeAll: () => {
    if (!getFeatures().highlight) {
      return;
    }
    // Not awaited: the channel is only ready in a browser preview, never in portable stories.
    void addons?.ready?.().then(useHighlights);
  },
});
