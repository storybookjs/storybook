import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview';
import type { ThemesTypes } from './types';

export type { ThemesTypes } from './types';

export default () => definePreviewAddon<ThemesTypes>(addonAnnotations);

export * from './decorators';
