/* eslint-env browser */
import { addons, definePreview } from 'storybook/preview-api';

import { useHighlights } from './useHighlights';

if (globalThis?.FEATURES?.highlight && addons?.ready) {
  addons.ready().then(() => {
    const channel = addons.getChannel();
    useHighlights({ channel });
  });
}

export default () => definePreview({});
