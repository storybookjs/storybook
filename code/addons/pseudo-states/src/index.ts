import { definePreviewAddon } from 'storybook/internal/csf';
import { definePreview } from 'storybook/internal/preview-api';

import * as addonAnnotations from './preview';
import type { InteractionsTypes } from './types';

export { PARAM_KEY } from './constants';

export type { InteractionsTypes };

export default () => definePreviewAddon<InteractionsTypes>(addonAnnotations);
