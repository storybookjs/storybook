/* eslint-env browser */
import { addons, definePreview } from 'storybook/preview-api';

import { useHighlights } from './useHighlights';

if (globalThis?.FEATURES?.highlight && addons?.ready) {
  addons.ready().then(useHighlights);
}

export default () => definePreview({});
