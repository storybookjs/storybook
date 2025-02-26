import { definePreviewAddon } from 'storybook/internal/csf';

import addonAnnotations from './preview';
import type { EssentialsTypes } from './types';

export type { EssentialsTypes };

export default () => definePreviewAddon<EssentialsTypes>(addonAnnotations);
