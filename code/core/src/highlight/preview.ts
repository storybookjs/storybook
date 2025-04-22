/* eslint-env browser */
import { addons, definePreview } from 'storybook/preview-api';

import { useHighlights } from './useHighlights';

if (addons && addons.ready) {
  addons.ready().then(() => {
    const channel = addons.getChannel();
    useHighlights({ channel });
  });
}

export default () => definePreview({});
