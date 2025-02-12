import { definePreviewAddon } from 'storybook/internal/csf';
import { definePreview } from 'storybook/internal/preview-api';

import * as addonAnnotations from './preview';
import type { BackgroundTypes } from './types';

export default () => definePreviewAddon<BackgroundTypes>(addonAnnotations);

export type { BackgroundTypes };
