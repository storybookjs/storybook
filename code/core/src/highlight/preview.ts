/* eslint-env browser */
import { addons, definePreview } from 'storybook/preview-api';

import { useHighlights } from './useHighlights';

if (addons && addons.ready) {
  addons.ready().then((channel) => useHighlights({ channel }));
}

export default () => definePreview({});
