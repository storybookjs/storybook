import { definePreviewAddon } from 'storybook/internal/csf';

import * as addonAnnotations from './preview.ts';
import type { ThemesTypes } from './types.ts';

export type { ThemesGlobals, ThemesTypes } from './types.ts';

export default () => definePreviewAddon<ThemesTypes>(addonAnnotations);

export * from './decorators/index.ts';
