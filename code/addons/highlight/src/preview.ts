/* eslint-env browser */
import { addons } from 'storybook/preview-api';

import { useHighlights } from './useHighlights';

useHighlights({
  channel: addons.getChannel(),
});
