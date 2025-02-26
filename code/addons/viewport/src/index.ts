import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview';
import type { ViewportTypes } from './types';

export * from './defaults';
export type * from './types';

export default () => definePreviewAddon<ViewportTypes>(addonAnnotations);
