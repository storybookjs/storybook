import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview';
import type { MeasureTypes } from './types';

export type { MeasureTypes };

export default () => definePreviewAddon<MeasureTypes>(addonAnnotations);
