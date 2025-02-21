import { definePreviewAddon } from 'storybook/internal/csf';
import { definePreview } from 'storybook/internal/preview-api';

import * as addonAnnotations from './preview';
import type { OutlineTypes } from './types';

export type { OutlineTypes };

export default () => definePreviewAddon<OutlineTypes>(addonAnnotations);
